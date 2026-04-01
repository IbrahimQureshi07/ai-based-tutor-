-- =====================================================
-- DIAGNOSTIC: Run these one by one in Supabase SQL Editor
-- Copy each result and share with the assistant.
-- =====================================================

-- STEP 1: Saray subjects aur unki counts dekho
SELECT subject, COUNT(*) as count
FROM public.questions
GROUP BY subject
ORDER BY subject;

-- =====================================================

-- STEP 2: Check karo ke A6 questions DB mein hain ya nahi
-- (A6 CSV ki pehli 3 questions ka first word match)
SELECT id, LEFT("Question", 80) as question_preview, subject
FROM public.questions
WHERE "Question" ILIKE '%closing event is to%'
   OR "Question" ILIKE '%Settlement Procedures Act%'
   OR "Question" ILIKE '%day of closing%'
   OR "Question" ILIKE '%proration%'
   OR "Question" ILIKE '%documentary stamp%'
LIMIT 10;

-- =====================================================

-- STEP 3: Check karo ke B5 questions DB mein hain ya nahi
-- (B5 is SC-specific, look for South Carolina mentions)
SELECT id, LEFT("Question", 80) as question_preview, subject
FROM public.questions
WHERE "Question" ILIKE '%South Carolina%'
   OR "Question" ILIKE '%broker-in-charge%'
   OR "Question" ILIKE '%Real Estate Commission%'
LIMIT 10;
