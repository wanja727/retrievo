package app.retrievo.content.file;

import app.retrievo.content.QuestionPurpose;
import app.retrievo.content.QuestionStatus;
import app.retrievo.content.QuestionType;
import app.retrievo.content.file.ContentFile.CoreQuestionDef;
import app.retrievo.content.file.ContentFile.QuestionDef;
import java.util.HashSet;
import java.util.Set;

/**
 * 배운 날에 푸는 문제를 고른다.
 *
 * <ul>
 *   <li>핵심 질문을 적은 파일: 핵심 질문마다 검수 완료된 판정 문제 가운데 파일에서 가장 먼저 나오는 것 하나.
 *       나머지 판정 문제는 지연 확인(3일, 7일, 21일 뒤)에서 묻는다
 *   <li>핵심 질문을 적지 않은 파일: 판정 문제 전부 (지금까지와 같다)
 * </ul>
 *
 * 문제를 한 번에 다 풀게 하면 지치고, 며칠 뒤에 다른 문제로 다시 만나는 쪽이 기억에 남아서다.
 * 콘텐츠 저장소는 핵심 질문마다 본문의 예시로 묻는 문제를 먼저 적는다 (dev-lessons의 docs/lesson-standard.md 4장).
 */
public final class LessonDaySet {

    private LessonDaySet() {
    }

    /** 배운 날에 푸는 문제의 키(파일 안의 짧은 키) */
    public static Set<String> keys(ContentFile file) {
        Set<String> keys = new HashSet<>();
        if (file.coreQuestions() == null) {
            for (QuestionDef q : file.questions()) {
                if (isJudgment(q)) {
                    keys.add(q.key());
                }
            }
            return keys;
        }
        for (CoreQuestionDef core : file.coreQuestions()) {
            for (QuestionDef q : file.questions()) {
                if (core.key().equals(q.coreQuestion()) && isJudgment(q)
                        && ContentValidator.statusOf(q.status()) == QuestionStatus.REVIEWED) {
                    keys.add(q.key());
                    break;
                }
            }
        }
        return keys;
    }

    private static boolean isJudgment(QuestionDef q) {
        QuestionType type = ContentValidator.typeOf(q.type());
        return type != null && type.purpose() == QuestionPurpose.JUDGMENT;
    }
}
