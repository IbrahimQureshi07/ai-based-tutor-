# 🚀 Complete Commands Guide - Step by Step

## ✅ Already Done (Main ne kar diya)
- ✅ Git repository initialize ho gaya
- ✅ Sab files Git mein add ho gaye
- ✅ `.env` file Git se protect hai (safe!)
- ✅ Package.json mein preview script add ho gaya

---

## 📋 Ab Aapko Ye Commands Run Karni Hain

### STEP 1: Dependencies Install Karein

**Command:**
```bash
npm install
```

**Kya Hoga:**
- Sab dependencies install hongi (React, Vite, Tailwind, etc.)
- `node_modules` folder banega
- 2-3 minutes lag sakte hain

**Kyun Chahiye:**
- Project run karne ke liye dependencies chahiye
- Pehli baar setup karne ke liye zaroori hai

---

### STEP 2: Localhost Pe Test Karein

**Command:**
```bash
npm run dev
```

**Kya Hoga:**
- Development server start hoga
- Terminal mein URL dikhega: `http://localhost:5173`
- Browser mein automatically open ho sakta hai
- Agar nahi khula, manually browser mein URL open karein

**Kyun Chahiye:**
- Pehle localhost pe test karna zaroori hai
- Changes dekhne ke liye
- Errors check karne ke liye

**Stop Karne Ke Liye:**
- Terminal mein `Ctrl + C` press karein

---

### STEP 3: Production Build Test (Optional)

**Command:**
```bash
npm run build
```

**Kya Hoga:**
- Production build banega
- `dist` folder create hoga
- Optimized files banengi

**Kyun Chahiye:**
- Deploy karne se pehle check karna
- Build errors dekhne ke liye

**Preview Command:**
```bash
npm run preview
```
- Production build ko localhost pe test karega

---

### STEP 4: Git Commit (Code Save Karein)

**Command 1:**
```bash
git commit -m "Initial commit: AI-Based Tutor with adaptive learning"
```

**Kya Hoga:**
- Sab changes save ho jayengi
- Git history mein record hoga

**Kyun Chahiye:**
- Code ko track karne ke liye
- Version control ke liye

**Note:** Agar pehli baar Git use kar rahe hain, pehle ye run karein:
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

### STEP 5: GitHub Pe Push (Optional - Agar GitHub Use Karna Ho)

**Pehle GitHub Repository Banana:**
1. https://github.com pe jayein
2. "New repository" click karein
3. Repository name: `ai-based-tutor` (ya kuch bhi)
4. "Create repository" click karein

**Commands:**
```bash
git remote add origin https://github.com/YOUR_USERNAME/ai-based-tutor.git
git branch -M main
git push -u origin main
```

**Kya Hoga:**
- Code GitHub pe upload ho jayega
- Online available hoga
- Baad mein hosting ke liye use kar sakte hain

**Kyun Chahiye:**
- Code backup ke liye
- Collaboration ke liye
- Hosting ke liye (Vercel/Netlify)

---

## 📝 Commands Summary

### Development Commands:
```bash
npm install          # Dependencies install (pehli baar)
npm run dev          # Local server start (development)
npm run build        # Production build banane ke liye
npm run preview      # Production build test karne ke liye
```

### Git Commands:
```bash
git status           # Current status dekhne ke liye
git add .            # Sab files add karne ke liye (already done)
git commit -m "msg"  # Changes save karne ke liye
git push             # GitHub pe upload karne ke liye
```

---

## 🎯 Recommended Flow (Step by Step)

### Pehli Baar Setup:
```
1. npm install          ← Dependencies install
2. npm run dev          ← Test karein localhost pe
3. git commit -m "..."  ← Code save karein
4. (Optional) GitHub setup ← Agar GitHub use karna ho
```

### Baad Mein Changes:
```
1. Code edit karein
2. npm run dev          ← Test karein
3. git add .            ← Changes add karein
4. git commit -m "..."   ← Save karein
5. git push              ← GitHub pe upload (agar setup hai)
```

---

## ⚠️ Important Notes

### 1. .env File Safety
- ✅ `.env` file Git mein commit nahi hogi (already protected)
- ✅ API keys safe hain
- ✅ GitHub pe push karne se expose nahi honge

### 2. node_modules
- ❌ `node_modules` Git mein commit nahi hoga (already in .gitignore)
- ✅ Har baar `npm install` se banega

### 3. Build Errors
- Agar `npm run build` mein error aaye:
  - Pehle `npm run dev` mein test karein
  - Console errors check karein
  - Dependencies install ho gayi hain ya nahi check karein

---

## 🐛 Common Issues & Solutions

### Issue 1: `npm install` fails
**Solution:**
- Node.js installed hai ya nahi check karein: `node --version`
- Node.js 18+ chahiye
- Download: https://nodejs.org

### Issue 2: `npm run dev` mein error
**Solution:**
- Pehle `npm install` run karein
- `.env` file check karein (API key sahi hai ya nahi)
- Browser console check karein

### Issue 3: Git commands fail
**Solution:**
- Git installed hai ya nahi check karein: `git --version`
- Download: https://git-scm.com
- User name/email configure karein (pehle command section mein diya hai)

---

## 📞 Next Steps After Setup

1. ✅ Localhost pe test karein (`npm run dev`)
2. ✅ Chatbot test karein (API key check)
3. ✅ Practice test try karein
4. ✅ Adaptive learning check karein
5. ✅ Production build test karein (`npm run build`)
6. ✅ (Optional) GitHub pe push karein
7. ✅ (Optional) Vercel/Netlify pe deploy karein

---

**Sab kuch ready hai! Bas commands run karein aur enjoy karein! 🎉**


