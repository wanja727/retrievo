package app.retrievo.content;

import app.retrievo.content.file.ContentFile;
import app.retrievo.content.file.ContentFile.ConceptDef;
import app.retrievo.content.file.ContentFile.QuestionDef;
import app.retrievo.content.file.ContentFileParser;
import app.retrievo.content.file.ContentValidationException;
import app.retrievo.content.file.ContentValidator;
import app.retrievo.content.file.LessonDaySet;
import app.retrievo.content.file.LessonSteps;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 콘텐츠 저장소의 문제 파일을 서비스 DB로 가져온다.
 *
 * <ul>
 *   <li>키(주제/레슨/문제)로 기존 행을 찾으므로 같은 파일을 다시 가져와도 결과가 같다</li>
 *   <li>문제 내용이 바뀐 경우에만 새 버전을 만든다. 이전 버전과 그 풀이 기록은 그대로 남는다</li>
 *   <li>파일에서 빠진 문제는 지우지 않고 숨긴다 (풀이 기록이 가리키고 있을 수 있다)</li>
 *   <li>파일에 오류가 하나라도 있으면 아무것도 넣지 않는다</li>
 * </ul>
 */
@Service
public class ContentImporter {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final SubjectRepository subjects;
    private final UnitRepository units;
    private final LessonRepository lessons;
    private final ConceptRepository concepts;
    private final QuestionRepository questions;
    private final QuestionVersionRepository versions;

    public ContentImporter(SubjectRepository subjects, UnitRepository units, LessonRepository lessons,
            ConceptRepository concepts, QuestionRepository questions, QuestionVersionRepository versions) {
        this.subjects = subjects;
        this.units = units;
        this.lessons = lessons;
        this.concepts = concepts;
        this.questions = questions;
        this.versions = versions;
    }

    @Transactional
    public ImportReport importYaml(String source, String yaml) {
        ContentFile file = ContentFileParser.parse(source, yaml);
        ContentValidator.Result result = ContentValidator.validate(file);
        if (!result.errors().isEmpty()) {
            throw new ContentValidationException(source, result.errors());
        }

        Subject subject = subjects.findBySlug(file.subject().key())
                .orElseGet(() -> subjects.save(new Subject(file.subject().key(), file.subject().name())));
        subject.rename(file.subject().name());

        int lessonOrder = file.lesson().order();
        Unit unit = units.findBySubjectIdAndTitle(subject.getId(), file.lesson().unit())
                .orElseGet(() -> units.save(new Unit(subject.getId(), file.lesson().unit(), lessonOrder)));
        unit.includeLessonOrder(lessonOrder);

        String lessonKey = subject.getSlug() + "/" + file.lesson().key();
        Lesson lesson = lessons.findByExternalKey(lessonKey)
                .orElseGet(() -> lessons.save(
                        new Lesson(lessonKey, unit.getId(), file.lesson().title(), lessonOrder)));
        lesson.update(unit.getId(), file.lesson().title(), lessonOrder, toJson(file.steps()));

        Map<String, Concept> conceptByKey = new HashMap<>();
        for (ConceptDef def : file.concepts()) {
            String key = lessonKey + "/" + def.key();
            Concept concept = concepts.findByExternalKey(key)
                    .orElseGet(() -> concepts.save(new Concept(key, lesson.getId(), def.name())));
            concept.update(lesson.getId(), def.name());
            conceptByKey.put(def.key(), concept);
        }

        int created = 0;
        int newVersions = 0;
        int unchanged = 0;
        Set<String> seen = new HashSet<>();

        // 배운 날에 푸는 문제: 핵심 질문마다 첫 판정 문제 하나. 핵심 질문이 없는 파일은 판정 문제 전부
        Set<String> lessonDay = LessonDaySet.keys(file);
        List<QuestionDef> defs = file.questions();
        for (int order = 0; order < defs.size(); order++) {
            QuestionDef def = defs.get(order);
            String key = lessonKey + "/" + def.key();
            seen.add(key);

            QuestionType type = ContentValidator.typeOf(def.type());
            QuestionStatus status = ContentValidator.statusOf(def.status());
            QuestionContent content = toContent(def, type);
            String hash = hash(content);
            Concept concept = conceptByKey.get(def.concept());

            Optional<Question> existing = questions.findByExternalKey(key);
            if (existing.isEmpty()) {
                Question question = questions.save(
                        new Question(key, lesson.getId(), concept.getId(), type.purpose(), status, order,
                                lessonDay.contains(def.key())));
                question.pointTo(versions.save(new QuestionVersion(question.getId(), 1, content, hash)));
                created++;
                continue;
            }

            Question question = existing.get();
            question.update(lesson.getId(), concept.getId(), type.purpose(), status, order,
                    lessonDay.contains(def.key()));
            QuestionVersion current = versions.findById(question.getCurrentVersionId()).orElseThrow();
            if (current.getContentHash().equals(hash)) {
                unchanged++;
            } else {
                question.pointTo(versions.save(
                        new QuestionVersion(question.getId(), current.getVersionNo() + 1, content, hash)));
                newVersions++;
            }
        }

        int hidden = 0;
        for (Question question : questions.findByLessonId(lesson.getId())) {
            if (!seen.contains(question.getExternalKey()) && question.getStatus() != QuestionStatus.HIDDEN) {
                question.hide();
                hidden++;
            }
        }

        return new ImportReport(source, created, newVersions, unchanged, hidden, result.warnings());
    }

    private static QuestionContent toContent(QuestionDef def, QuestionType type) {
        String answer = switch (type) {
            case MULTIPLE_CHOICE, CODE_PREDICT -> String.valueOf(Integer.parseInt(def.answer().trim()));
            case OX -> def.answer().trim().toUpperCase(Locale.ROOT);
            case LINE_PICK -> LinePicks.normalize(def.answer(), LinePicks.lineCount(def.code())).orElseThrow();
            case DESCRIPTIVE -> null;
        };
        return new QuestionContent(
                type,
                def.body(),
                def.code(),
                type.hasChoices() ? List.copyOf(def.choices()) : null,
                answer,
                def.explanation(),
                type == QuestionType.DESCRIPTIVE ? List.copyOf(def.checklist()) : null,
                def.source(),
                def.difficulty());
    }

    /** 레슨 본문을 DB에 넣을 JSON으로. 본문이 없는 레슨은 null (화면이 레슨 사이트로 연결한다) */
    static String toJson(LessonSteps steps) {
        if (steps == null) {
            return null;
        }
        try {
            return JSON.writeValueAsString(steps);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    static String hash(QuestionContent content) {
        try {
            byte[] json = JSON.writeValueAsBytes(content);
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(json);
            return HexFormat.of().formatHex(digest);
        } catch (JsonProcessingException | NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
