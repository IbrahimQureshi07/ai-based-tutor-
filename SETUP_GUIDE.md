# 🚀 Complete Setup Guide - Step by Step

## Step 1: Install Dependencies

Open terminal in the project folder and run:
```bash
npm install
```

## Step 2: Create .env File

1. In the root folder (`Ai-Based tutor`), create a new file named `.env`
2. Open it in a text editor
3. Add this line (replace with your actual API key):
   ```
   VITE_OPENAI_API_KEY=sk-your-actual-key-here
   ```
4. Save the file

**Where to get API key?**
- Visit: https://platform.openai.com/api-keys
- Sign up/Login
- Click "Create new secret key"
- Copy and paste in .env file

## Step 3: Run the Project

```bash
npm run dev
```

## Step 4: Open in Browser

The terminal will show a URL like:
```
http://localhost:5173
```

Open this in your browser.

## ✅ You're Done!

Now you can:
- Test the AI chatbot (click the chat button)
- Take practice tests
- See adaptive learning in action

## 🔒 Important: Git Safety

Your `.env` file is already protected by `.gitignore`. This means:
- ✅ It won't be uploaded to Git
- ✅ Your API key stays private
- ✅ Safe to push code to GitHub

## 🐛 Common Issues

**Issue: Chatbot shows error**
- Solution: Check if `.env` file exists and has correct API key

**Issue: npm install fails**
- Solution: Make sure Node.js is installed (version 18+)

**Issue: Port already in use**
- Solution: Close other apps using port 5173, or Vite will auto-use another port

## 📞 Need Help?

Check the main README.md for detailed documentation.


