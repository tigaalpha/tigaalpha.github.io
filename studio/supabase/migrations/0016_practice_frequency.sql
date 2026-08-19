-- PRD "Course Recommendation": recommend based on age, goal, budget,
-- experience, and practice frequency — the first four already had columns;
-- practice frequency was only ever captured in freeform notes.

alter table customers add column practice_frequency text;
