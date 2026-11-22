package app.retrievo.learning;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "answer_submission")
public class AnswerSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    private Long questionVersionId;

    private UUID clientSubmissionId;

    private String selected;

    private boolean correct;

    @Column(name = "is_delayed_check")
    private boolean delayedCheck;

    /** 이 문제를 처음 푼 답인지. 기록 화면의 정답률은 첫 시도만 센다 (ADR-021) */
    private boolean firstAttempt;

    private LocalDate serviceDate;

    private Instant submittedAt;

    protected AnswerSubmission() {
    }

    public AnswerSubmission(Long userId, Long questionVersionId, UUID clientSubmissionId, String selected,
            boolean correct, boolean delayedCheck, boolean firstAttempt, LocalDate serviceDate, Instant submittedAt) {
        this.userId = userId;
        this.questionVersionId = questionVersionId;
        this.clientSubmissionId = clientSubmissionId;
        this.selected = selected;
        this.correct = correct;
        this.delayedCheck = delayedCheck;
        this.firstAttempt = firstAttempt;
        this.serviceDate = serviceDate;
        this.submittedAt = submittedAt;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public Long getQuestionVersionId() {
        return questionVersionId;
    }

    public UUID getClientSubmissionId() {
        return clientSubmissionId;
    }

    public String getSelected() {
        return selected;
    }

    public boolean isCorrect() {
        return correct;
    }

    public boolean isDelayedCheck() {
        return delayedCheck;
    }

    public boolean isFirstAttempt() {
        return firstAttempt;
    }

    public LocalDate getServiceDate() {
        return serviceDate;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }
}
