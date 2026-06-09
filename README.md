# THE FEED — Setup Guide

A self-updating news site. Add a folder, push to GitHub. The homepage updates itself.

---

## First-Time Setup (5 minutes)

### 1. Create a GitHub repo
Go to github.com → New repository → name it anything (e.g. `my-news-site`) → Public → Create.

### 2. Push this folder to GitHub
```bash
cd this-folder
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### 3. Enable GitHub Pages
- Go to your repo on GitHub
- Settings → Pages
- Source: Deploy from a branch
- Branch: main / (root)
- Save

Your site will be live at: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

### 4. Update the config in index.html and all.html
Find these two lines (they appear in BOTH files) and fill them in:
```javascript
const GITHUB_USER = 'YOUR_GITHUB_USERNAME';
const GITHUB_REPO = 'YOUR_REPO_NAME';
```

Commit and push again. Done.

---

## Writing a New Article

1. Create a new folder with the next number: `0005/`
2. Copy `0004/index.html` into it as a starting point
3. Edit the content — change the title, date, description, and body text
4. Add images to the folder if you have them
   - Name your hero/thumbnail image **`thumb.jpg`** — this shows on the homepage card
5. Push to GitHub:
```bash
git add .
git commit -m "article 0005: your headline here"
git push
```

The homepage automatically shows your newest 3 articles. The all-articles page lists everything.

---

## Article Template (copy this every time)

```html
<title>YOUR HEADLINE HERE</title>
<meta name="date" content="YYYY-MM-DD">
<meta name="description" content="One or two sentence teaser. This shows on the homepage card and the all-articles list.">
```

These three tags are the only things the homepage reads from your article. Everything else is up to you.

---

## Folder Structure

```
your-repo/
├── index.html        ← Homepage (never edit manually)
├── all.html          ← Archive page (never edit manually)
├── style.css         ← All styles — edit this to change the look
├── README.md
├── 0001/
│   ├── index.html    ← Article content
│   └── thumb.jpg     ← Homepage thumbnail (optional)
├── 0002/
│   └── index.html
└── 0005/             ← Your next article
    ├── index.html
    ├── thumb.jpg
    └── photo-2.jpg
```

---

## Thumbnail Images

- Name it **`thumb.jpg`** or **`thumb.png`** inside the article folder
- Recommended size: 1200 × 750px (16:10 ratio)
- If there's no thumbnail, the homepage shows a striped placeholder — that's fine

---

## Changing the Site Name

Search and replace `THE FEED` in `index.html`, `all.html`, and `style.css`.

---

## Rate Limits

The GitHub API allows 60 requests/hour per IP address without authentication.
For a personal or small publication, this is plenty. If you ever go viral and need more,
the next step would be adding a build script that generates a static `articles.json` at deploy time.
