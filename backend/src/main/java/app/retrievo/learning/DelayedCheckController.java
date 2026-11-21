package app.retrievo.learning;

import app.retrievo.auth.CurrentUser;
import app.retrievo.common.ServiceDates;
import app.retrievo.content.LessonQueryService;
import app.retrievo.content.QuestionView;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class DelayedCheckController {

    private final ConceptProgresses progresses;
    private final LessonQueryService lessons;
    private final Clock clock;

    DelayedCheckController(ConceptProgresses progresses, LessonQueryService lessons, Clock clock) {
        this.progresses = progresses;
        this.lessons = lessons;
        this.clock = clock;
    }

    /**
     * 오늘 확인할 개념과, 개념마다 처음과 다른 문제 하나. 답은 mode=DELAYED_CHECK로 제출한다.
     * attemptNo: 이번 확인 전까지 통과한 확인 수(1~3). 1이면 3일, 2면 7일, 3이면 21일 확인이다.
     * 통과하면 이 수가 하나 늘고, 4가 되면 졸업이다 (ADR-017)
     * sureWrong: 지난 확인에서 확실했는데 틀려서 다음 날 다시 묻는 개념. 목록 맨 앞에 온다
     * teach: 마지막(21일) 확인일 때만. 판정 문제를 맞혀 졸업한 뒤 동료에게 가르치듯 말해 볼 질문 (자기 채점)
     */
    public record TodayCheck(long conceptId, String conceptName, int attemptNo, LocalDate dueDate,
            LocalDate learnedOn, boolean sureWrong, QuestionView question, LessonQueryService.TeachPrompt teach) {
    }

    @GetMapping("/api/me/delayed-checks/today")
    public List<TodayCheck> today(@CurrentUser long userId) {
        LocalDate today = ServiceDates.today(clock);
        return progresses.due(userId, today).stream()
                .map(due -> toCheck(userId, due))
                .flatMap(Optional::stream)
                .toList();
    }

    /**
     * 풀어 본 개념의 진행 상태. stage: 통과한 확인 수(0 = 배우는 중, 4 = 졸업). dueDate: 다음 확인 날.
     * bestStage: 지금까지 도달한 가장 높은 단계. 틀려서 stage가 내려가도 줄지 않는다. 화면은 이 값을 기억 기록으로 보여준다 (ADR-025)
     */
    public record ConceptStatus(long conceptId, String conceptName, long lessonId, String lessonTitle, int stage,
            boolean graduated, LocalDate learnedOn, LocalDate dueDate, boolean sureWrong, Instant graduatedAt,
            int bestStage) {
    }

    @GetMapping("/api/me/concepts")
    public List<ConceptStatus> concepts(@CurrentUser long userId) {
        return progresses.all(userId).stream()
                .map(p -> new ConceptStatus(p.conceptId(), p.conceptName(), p.lessonId(), p.lessonTitle(),
                        p.stage(), p.stage() == ReviewSchedule.GRADUATED, p.learnedOn(), p.dueDate(),
                        p.sureWrong(), p.graduatedAt(), p.bestStage()))
                .toList();
    }

    /**
     * 연습할 문제 하나 (ADR-021). 지연 확인에서 틀린 뒤 그날 다시 배울 때 쓴다. 답은 mode=PRACTICE로 제출하고 일정은 바뀌지 않는다.
     * 아직 안 푼 문제를 먼저, 다 풀었으면 가장 오래전에 푼 문제라서 방금 틀린 문제와 다른 문제가 나온다.
     * 배운 날 기준을 넘은 개념(1단계 이상)만 연습할 수 있다
     */
    @GetMapping("/api/me/concepts/{conceptId}/practice-question")
    public QuestionView practiceQuestion(@CurrentUser long userId, @PathVariable long conceptId) {
        if (!progresses.learned(userId, conceptId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "연습할 수 있는 개념이 아니다");
        }
        return lessons.questionForDelayedCheck(userId, conceptId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "연습할 문제가 없다"));
    }

    private Optional<TodayCheck> toCheck(long userId, ConceptProgresses.Due due) {
        return lessons.questionForDelayedCheck(userId, due.conceptId())
                .map(q -> new TodayCheck(due.conceptId(), due.conceptName(), due.stage(), due.dueDate(),
                        due.learnedOn(), due.sureWrong(), q,
                        due.stage() == ReviewSchedule.GRADUATED - 1
                                ? lessons.teachPrompt(due.conceptId()).orElse(null)
                                : null));
    }
}
