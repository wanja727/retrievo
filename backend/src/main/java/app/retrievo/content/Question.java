package app.retrievo.content;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 문제의 정체성(키, 소속, 상태). 내용은 QuestionVersion에 있다 */
@Entity
@Table(name = "question")
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String externalKey;

    private Long lessonId;

    private Long conceptId;

    @Enumerated(EnumType.STRING)
    private QuestionPurpose purpose;

    @Enumerated(EnumType.STRING)
    private QuestionStatus status;

    private int sortOrder;

    /** 배운 날에 푸는 문제인지. 아니면 지연 확인에서만 묻는다 (LessonDaySet) */
    private boolean lessonDay;

    private Long currentVersionId;

    protected Question() {
    }

    public Question(String externalKey, Long lessonId, Long conceptId, QuestionPurpose purpose,
            QuestionStatus status, int sortOrder, boolean lessonDay) {
        this.externalKey = externalKey;
        this.lessonId = lessonId;
        this.conceptId = conceptId;
        this.purpose = purpose;
        this.status = status;
        this.sortOrder = sortOrder;
        this.lessonDay = lessonDay;
    }

    public void update(Long lessonId, Long conceptId, QuestionPurpose purpose, QuestionStatus status,
            int sortOrder, boolean lessonDay) {
        this.lessonId = lessonId;
        this.conceptId = conceptId;
        this.purpose = purpose;
        this.status = status;
        this.sortOrder = sortOrder;
        this.lessonDay = lessonDay;
    }

    public void hide() {
        this.status = QuestionStatus.HIDDEN;
    }

    public void pointTo(QuestionVersion version) {
        this.currentVersionId = version.getId();
    }

    public Long getId() {
        return id;
    }

    public String getExternalKey() {
        return externalKey;
    }

    public Long getLessonId() {
        return lessonId;
    }

    public Long getConceptId() {
        return conceptId;
    }

    public QuestionPurpose getPurpose() {
        return purpose;
    }

    public QuestionStatus getStatus() {
        return status;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public boolean isLessonDay() {
        return lessonDay;
    }

    public Long getCurrentVersionId() {
        return currentVersionId;
    }
}
