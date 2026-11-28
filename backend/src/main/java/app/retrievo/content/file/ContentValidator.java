package app.retrievo.content.file;

import app.retrievo.content.LinePicks;
import app.retrievo.content.QuestionPurpose;
import app.retrievo.content.QuestionStatus;
import app.retrievo.content.QuestionType;
import app.retrievo.content.file.ContentFile.ConceptDef;
import app.retrievo.content.file.ContentFile.CoreQuestionDef;
import app.retrievo.content.file.ContentFile.QuestionDef;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 문제 파일 검사. 오류가 하나라도 있으면 그 파일은 가져오지 않는다.
 * 경고는 가져오되 알려준다 (예: 지연 확인에 쓸 판정 문제가 모자란 개념).
 */
public final class ContentValidator {

    private static final Pattern KEY = Pattern.compile("[a-z0-9][a-z0-9-]*");
    private static final int MIN_JUDGMENT_PER_CONCEPT = 2;
    private static final int RECOMMENDED_CHECKLIST = 4;
    private static final int CORE_POINTS_MIN = 1;
    private static final int CORE_POINTS_MAX = 4;
    /** 문제의 coreQuestion에 쓰는 값: 핵심 질문 전체를 아우르는 문제 */
    public static final String ALL_CORE_QUESTIONS = "all";

    public record Result(List<String> errors, List<String> warnings) {
    }

    private ContentValidator() {
    }

    public static QuestionType typeOf(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            return QuestionType.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public static QuestionStatus statusOf(String raw) {
        if (raw == null) {
            return QuestionStatus.DRAFT;
        }
        try {
            return QuestionStatus.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public static Result validate(ContentFile file) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (file.subject() == null) {
            errors.add("subject가 없다");
        } else {
            checkKey("subject.key", file.subject().key(), errors);
            checkText("subject.name", file.subject().name(), errors);
        }

        if (file.lesson() == null) {
            errors.add("lesson이 없다");
        } else {
            checkKey("lesson.key", file.lesson().key(), errors);
            checkText("lesson.title", file.lesson().title(), errors);
            checkText("lesson.unit", file.lesson().unit(), errors);
            if (file.lesson().order() == null) {
                errors.add("lesson.order가 없다");
            }
        }

        Set<String> conceptKeys = new HashSet<>();
        if (file.concepts() == null || file.concepts().isEmpty()) {
            errors.add("concepts가 비어 있다");
        } else {
            for (int i = 0; i < file.concepts().size(); i++) {
                ConceptDef c = file.concepts().get(i);
                String label = "concepts[" + i + "]";
                checkKey(label + ".key", c.key(), errors);
                checkText(label + ".name", c.name(), errors);
                if (c.key() != null && !conceptKeys.add(c.key())) {
                    errors.add(label + ": 개념 키 '" + c.key() + "'가 중복이다");
                }
            }
        }

        // 핵심 질문은 선택이다. 적은 파일은 모든 문제가 그중 하나(또는 all)에 묶여야 한다
        Set<String> coreQuestionKeys = null;
        if (file.coreQuestions() != null) {
            coreQuestionKeys = new HashSet<>();
            if (file.coreQuestions().isEmpty()) {
                errors.add("coreQuestions가 비어 있다. 쓰지 않으려면 항목을 지운다");
            }
            for (int i = 0; i < file.coreQuestions().size(); i++) {
                CoreQuestionDef c = file.coreQuestions().get(i);
                String label = "coreQuestions[" + i + "]";
                checkKey(label + ".key", c.key(), errors);
                checkText(label + ".text", c.text(), errors);
                checkCoreAnswer(label, c, errors);
                if (ALL_CORE_QUESTIONS.equals(c.key())) {
                    errors.add(label + ": '" + ALL_CORE_QUESTIONS + "'은 핵심 질문 전체를 뜻하는 값이라 키로 쓸 수 없다");
                } else if (c.key() != null && !coreQuestionKeys.add(c.key())) {
                    errors.add(label + ": 핵심 질문 키 '" + c.key() + "'가 중복이다");
                }
            }
        }

        // 개념별 검수 완료 판정 문제 수 (지연 확인용)
        Map<String, Integer> reviewedJudgments = new LinkedHashMap<>();
        conceptKeys.forEach(k -> reviewedJudgments.put(k, 0));

        Set<String> questionKeys = new HashSet<>();
        if (file.questions() == null || file.questions().isEmpty()) {
            errors.add("questions가 비어 있다");
        } else {
            for (int i = 0; i < file.questions().size(); i++) {
                QuestionDef q = file.questions().get(i);
                String label = "questions[" + i + "]" + (q.key() == null ? "" : " '" + q.key() + "'");
                checkQuestion(label, q, conceptKeys, questionKeys, errors, warnings);
                checkCoreQuestion(label, q, coreQuestionKeys, errors);

                QuestionType type = typeOf(q.type());
                if (type != null && type.purpose() == QuestionPurpose.JUDGMENT
                        && statusOf(q.status()) == QuestionStatus.REVIEWED
                        && reviewedJudgments.containsKey(q.concept())) {
                    reviewedJudgments.merge(q.concept(), 1, Integer::sum);
                }
            }
        }

        reviewedJudgments.forEach((concept, count) -> {
            if (count < MIN_JUDGMENT_PER_CONCEPT) {
                warnings.add("개념 '" + concept + "': 검수 완료된 판정 문제가 " + count + "개다. "
                        + "지연 확인에서 처음과 다른 문제를 내려면 " + MIN_JUDGMENT_PER_CONCEPT + "개 이상 필요하다");
            }
        });

        if (file.steps() != null) {
            LessonStepsValidator.validate(file.steps(), errors);
        }

        return new Result(errors, warnings);
    }

    private static void checkQuestion(String label, QuestionDef q, Set<String> conceptKeys,
            Set<String> questionKeys, List<String> errors, List<String> warnings) {
        checkKey(label + ".key", q.key(), errors);
        if (q.key() != null && !questionKeys.add(q.key())) {
            errors.add(label + ": 문제 키가 중복이다");
        }
        if (q.concept() == null || !conceptKeys.contains(q.concept())) {
            errors.add(label + ": concept '" + q.concept() + "'가 concepts에 없다");
        }
        QuestionStatus status = statusOf(q.status());
        if (status == null) {
            errors.add(label + ": status는 draft, reviewed, hidden 중 하나다");
        }
        if (q.difficulty() == null || q.difficulty() < 1 || q.difficulty() > 3) {
            errors.add(label + ": difficulty는 1~3이다");
        }
        checkText(label + ".body", q.body(), errors);
        checkText(label + ".explanation", q.explanation(), errors);

        QuestionType type = typeOf(q.type());
        if (type == null) {
            errors.add(label + ": type은 multiple_choice, ox, code_predict, line_pick, descriptive 중 하나다");
            return;
        }

        switch (type) {
            case MULTIPLE_CHOICE, CODE_PREDICT -> {
                List<String> choices = q.choices();
                if (choices == null || choices.size() < 2) {
                    errors.add(label + ": 보기(choices)가 2개 이상 필요하다");
                } else {
                    if (choices.stream().anyMatch(c -> c == null || c.isBlank())) {
                        errors.add(label + ": 빈 보기가 있다");
                    }
                    Integer answer = parseInt(q.answer());
                    if (answer == null || answer < 1 || answer > choices.size()) {
                        errors.add(label + ": answer는 보기 번호(1~" + choices.size() + ")다. 지금 값: " + q.answer());
                    }
                }
                if (q.checklist() != null) {
                    errors.add(label + ": 체크리스트는 서술형(descriptive)에만 쓴다");
                }
            }
            case OX -> {
                if (q.choices() != null) {
                    errors.add(label + ": OX 문제에는 보기를 쓰지 않는다");
                }
                String answer = q.answer() == null ? null : q.answer().trim().toUpperCase(Locale.ROOT);
                if (!"O".equals(answer) && !"X".equals(answer)) {
                    errors.add(label + ": OX 문제의 answer는 O 또는 X다. 지금 값: " + q.answer());
                }
                if (q.checklist() != null) {
                    errors.add(label + ": 체크리스트는 서술형(descriptive)에만 쓴다");
                }
            }
            case LINE_PICK -> {
                int lines = LinePicks.lineCount(q.code());
                if (lines == 0) {
                    errors.add(label + ": 줄 고르기 문제는 code가 필요하다");
                } else if (LinePicks.normalize(q.answer(), lines).isEmpty()) {
                    errors.add(label + ": answer는 줄 번호(1~" + lines + ")를 쉼표로 나열한다. 예: 7, 8. 지금 값: "
                            + q.answer());
                }
                if (q.choices() != null || q.checklist() != null) {
                    errors.add(label + ": 줄 고르기 문제에는 choices와 checklist를 쓰지 않는다");
                }
            }
            case DESCRIPTIVE -> {
                if (q.checklist() == null || q.checklist().isEmpty()) {
                    errors.add(label + ": 서술형은 자기 채점용 체크리스트가 필요하다");
                } else if (q.checklist().size() < RECOMMENDED_CHECKLIST) {
                    warnings.add(label + ": 체크리스트가 " + q.checklist().size() + "개다. "
                            + RECOMMENDED_CHECKLIST + "~5개를 권장한다 (4개 이상 정답 / 2~3개 부분 / 1개 이하 오답)");
                }
                if (q.answer() != null || q.choices() != null) {
                    errors.add(label + ": 서술형에는 answer와 choices를 쓰지 않는다 (체크리스트로 채점)");
                }
            }
        }

        if (status == QuestionStatus.REVIEWED && (q.source() == null || q.source().isBlank())) {
            warnings.add(label + ": 검수 완료 문제에 출처(source)가 없다");
        }
    }

    private static void checkCoreQuestion(String label, QuestionDef q, Set<String> coreQuestionKeys,
            List<String> errors) {
        if (coreQuestionKeys == null) {
            if (q.coreQuestion() != null) {
                errors.add(label + ": coreQuestion을 쓰려면 파일에 coreQuestions가 있어야 한다");
            }
            return;
        }
        if (q.coreQuestion() == null) {
            errors.add(label + ": coreQuestion이 없다. coreQuestions가 있는 파일은 모든 문제를 핵심 질문에 묶는다");
        } else if (!ALL_CORE_QUESTIONS.equals(q.coreQuestion()) && !coreQuestionKeys.contains(q.coreQuestion())) {
            errors.add(label + ": coreQuestion '" + q.coreQuestion() + "'가 coreQuestions에 없다");
        }
    }

    /** 모범 답과 핵심 포인트는 선택이지만 함께 적는다. 포인트는 답을 채점하는 기준이라 수를 제한한다 */
    private static void checkCoreAnswer(String label, CoreQuestionDef c, List<String> errors) {
        if (c.answer() == null && c.points() == null) {
            return;
        }
        if (c.answer() == null || c.points() == null) {
            errors.add(label + ": answer와 points는 함께 적는다");
            return;
        }
        checkText(label + ".answer", c.answer(), errors);
        if (c.points().size() < CORE_POINTS_MIN || c.points().size() > CORE_POINTS_MAX) {
            errors.add(label + ": points가 " + c.points().size() + "개다. "
                    + CORE_POINTS_MIN + "~" + CORE_POINTS_MAX + "개로 적는다");
        }
        for (int i = 0; i < c.points().size(); i++) {
            checkText(label + ".points[" + i + "]", c.points().get(i), errors);
        }
    }

    private static void checkKey(String label, String key, List<String> errors) {
        if (key == null || !KEY.matcher(key).matches()) {
            errors.add(label + "는 영문 소문자·숫자·하이픈이다. 지금 값: " + key);
        }
    }

    private static void checkText(String label, String text, List<String> errors) {
        if (text == null || text.isBlank()) {
            errors.add(label + "가 비어 있다");
        }
    }

    private static Integer parseInt(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
