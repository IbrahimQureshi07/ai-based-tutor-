import { PracticeTest } from './PracticeTest';

// Assessment = 10 questions from GPT based on user's weak areas (DB), not from sheet
export function Assessment() {
  return <PracticeTest questionLimit={10} assessmentMode />;
}
