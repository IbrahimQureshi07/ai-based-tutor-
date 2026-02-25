# AI-Based Tutor - State Level Exam Preparation Platform

An intelligent AI-powered exam preparation platform that helps students prepare for state-level exams with adaptive learning, AI-generated questions, and personalized tutoring.

## 🌟 Features

- **AI-Powered Chatbot**: Real-time study assistance using GPT API
- **Adaptive Learning**: Wrong questions are repeated until answered correctly
- **Multiple Test Modes**: Practice Tests, Mock Tests, and Final Exams
- **AI Question Generation**: Dynamic question generation based on difficulty and topics
- **Progress Tracking**: Detailed analytics with scoreboards and charts
- **Personalized Feedback**: AI provides explanations and study suggestions
- **Weak Area Identification**: Automatically tracks and focuses on weak subjects

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- OpenAI API Key ([Get one here](https://platform.openai.com/api-keys))

### Installation

1. **Clone or download the project**
   ```bash
   cd "Ai-Based tutor"
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   VITE_OPENAI_API_KEY=your_openai_api_key_here
   ```
   
   ⚠️ **IMPORTANT**: Never commit your `.env` file to Git! It's already in `.gitignore`.

4. **Start the development server**
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

5. **Open your browser**
   - Navigate to `http://localhost:5173` (or the port shown in terminal)

## 📁 Project Structure

```
Ai-Based tutor/
├── src/
│   ├── app/
│   │   ├── components/        # React components
│   │   │   ├── AIChatbot.tsx  # AI chatbot component
│   │   │   ├── PracticeTest.tsx # Practice test with adaptive learning
│   │   │   ├── MockTest.tsx   # Mock exam component
│   │   │   └── ...
│   │   ├── context/           # React context for state management
│   │   ├── data/              # Mock data and question bank
│   │   ├── services/          # API services
│   │   │   └── aiService.ts   # GPT API integration
│   │   └── App.tsx            # Main app component
│   └── styles/                # CSS and styling
├── .env                       # Environment variables (create this)
├── .gitignore                 # Git ignore file
└── package.json              # Dependencies
```

## 🔑 API Key Setup

### Getting Your OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to [API Keys](https://platform.openai.com/api-keys)
4. Click "Create new secret key"
5. Copy the key (you won't see it again!)

### Setting Up .env File

1. Create a file named `.env` in the root directory
2. Add your API key:
   ```env
   VITE_OPENAI_API_KEY=sk-your-actual-api-key-here
   ```
3. Save the file

### ⚠️ Security Note

- **NEVER** commit `.env` to Git
- The `.gitignore` file already includes `.env` to protect your keys
- If you accidentally commit it, rotate your API key immediately

## 🎯 How It Works

### Adaptive Learning System

1. Student answers a question
2. If **incorrect**: 
   - Question is marked for retry
   - Student cannot proceed until they answer correctly
   - AI provides explanations and hints
3. If **correct**: Student moves to next question
4. At the end, all wrong questions are shown again until all are correct

### AI Chatbot

- Ask study-related questions anytime
- Get explanations for concepts
- Receive personalized study tips
- Context-aware responses based on your progress

### Question Generation

- AI generates questions based on:
  - Subject and topic
  - Difficulty level
  - Similar to previous questions (for practice)
- Questions are tailored for state-level exam preparation

## 📊 Features in Detail

### Practice Test
- Unlimited hints (with tracking)
- Immediate feedback
- Adaptive learning (wrong questions repeat)
- AI tutor assistance

### Mock Test
- Timed exams (30 minutes)
- No hints allowed
- Real exam simulation
- Detailed results

### Final Exam
- Comprehensive assessment
- Unlocked after sufficient practice
- Full exam experience

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Adding Questions

Currently, questions are in `src/app/data/exam-data.ts`. You can:
1. Add more questions to the `mockQuestions` array
2. Use AI to generate questions dynamically (implemented in `aiService.ts`)
3. Import from Excel/CSV (future enhancement)

## 🚢 Deployment

### Before Deploying

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Set environment variables on your hosting platform**
   - Vercel: Add in Project Settings → Environment Variables
   - Netlify: Add in Site Settings → Environment Variables
   - Other platforms: Check their documentation

3. **Never expose API keys in client-side code**
   - Current setup uses Vite's `import.meta.env` which is safe
   - For production, consider using a backend proxy

### Recommended Hosting

- **Vercel** (Recommended for React/Vite)
- **Netlify**
- **GitHub Pages** (with GitHub Actions)

## 📝 Notes for Beginners

### What is .env file?
- Stores sensitive information (like API keys)
- Not shared in Git (protected by .gitignore)
- Each developer has their own copy

### Why .gitignore?
- Prevents accidentally sharing API keys
- Protects sensitive data
- Standard practice in development

### API Costs
- OpenAI charges per API call
- GPT-4o-mini is used (cheaper option)
- Monitor usage at [OpenAI Usage Dashboard](https://platform.openai.com/usage)

## 🐛 Troubleshooting

### Chatbot not working?
- Check if `.env` file exists
- Verify `VITE_OPENAI_API_KEY` is set correctly
- Check browser console for errors
- Ensure API key has credits

### Build errors?
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be 18+)

### API errors?
- Verify API key is valid
- Check OpenAI account has credits
- Review API usage limits

## 📚 Next Steps

1. ✅ Set up `.env` file with API key
2. ✅ Run `npm install`
3. ✅ Run `npm run dev`
4. ✅ Test the chatbot
5. ✅ Try practice tests
6. ✅ Customize questions for your exam

## 🤝 Contributing

This is a learning project. Feel free to:
- Add more questions
- Improve UI/UX
- Add new features
- Fix bugs

## 📄 License

This project is for educational purposes.

---

**Made with ❤️ for students preparing for state-level exams**
