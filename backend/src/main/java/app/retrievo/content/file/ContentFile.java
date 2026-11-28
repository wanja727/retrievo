package app.retrievo.content.file;

import java.util.List;

/**
 * 콘텐츠 저장소의 문제 파일 하나 (레슨 하나). 형식은 docs/content-format.md에 있다.
 * 키는 파일 안에서만 짧게 쓰고, 가져올 때 "주제/레슨/키"로 이어 붙여 전역 키를 만든다.
 */
public record ContentFile(
        SubjectDef subject,
        LessonDef lesson,
        List<ConceptDef> concepts,
        List<CoreQuestionDef> coreQuestions,
        List<QuestionDef> questions,
        LessonSteps steps) {

    public record SubjectDef(String key, String name) {
    }

    public record LessonDef(String key, String title, String unit, Integer order) {
    }

    public record ConceptDef(String key, String name) {
    }

    /**
     * 레슨의 핵심 질문. 문제가 어느 질문에서 나왔는지 묶는다.
     * answer(모범 답)와 points(답에 들어 있어야 하는 핵심 포인트)는 복습에서 사용자가 이 질문에 직접 답할 때 쓴다.
     * 둘은 선택이고, 적을 때는 함께 적는다.
     */
    public record CoreQuestionDef(String key, String text, String answer, List<String> points) {
    }

    public record QuestionDef(
            String key,
            String concept,
            String coreQuestion,
            String type,
            String status,
            Integer difficulty,
            String body,
            String code,
            List<String> choices,
            String answer,
            String explanation,
            List<String> checklist,
            String source) {
    }
}
