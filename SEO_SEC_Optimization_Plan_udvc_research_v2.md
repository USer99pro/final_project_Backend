# แผนปฏิบัติการแก้ไข SEO & Security เพื่อติด Top 10 Google
**สำหรับเว็บไซต์:** `https://udvc-research.online`  
**อ้างอิงจากรายงาน:** SEO Audit Report (SEOmator, 25 สิงหาคม 2026)  
**เป้าหมาย:** ปรับปรุงคะแนน SEO จาก 84/100 เป็น 98+/100, ปรับปรุง Security จาก 84/100 เป็น 100/100 และผลักดัน คลังข้อมูลงานวิจัย ให้ติดอันดับ 1-10 บน Google Search

---

## 📊 สรุปภาพรวมคะแนนปัจจุบัน (Baseline Scores)

| หมวดหมู่ (Category) | คะแนนปัจจุบัน | สถานะ | เป้าหมาย (Target) |
| :--- | :---: | :---: | :---: |
| **On-Page SEO (รวม)** | **84/100** | Good | **98-100/100** |
| **Core SEO** | **79/100** | Fail 2 / Warn 4 | **100/100** |
| **Security** | **84/100** | Warn 6 | **100/100** |
| **Content** | **72/100** | Fail 2 / Warn 2 | **95/100** |
| **Social (Open Graph)** | **33/100** | Fail 3 / Warn 5 | **100/100** |
| **E-E-A-T** | **60/100** | Warn 11 | **90/100** |
| **Accessibility** | **87/100** | Warn 3 | **100/100** |
| **Structured Data** | **86/100** | Warn 1 | **100/100** |
| **Performance** | **90/100** | Warn 4 | **98/100** |
| **AI / GEO Readiness** | **89/100** | Warn 1 | **100/100** |

---

## 🎯 ลำดับความสำคัญในการแก้ไข (Priority Action Plan)

```
[P0: วิกฤต/ส่งผลต่อ Ranking ชัดเจน] ──> Meta Description / Canonical / Duplicate H1 / Thin Content / OG Meta
[P1: ความปลอดภัย & Trust Signal] ──> HTTP Security Headers / HSTS Subdomains / E-E-A-T Pages
[P2: โครงสร้างข้อมูล & UX]      ──> Schema.org JSON-LD / Accessibility Labels / Font Swap & Brotli
[P3: ยุคใหม่ (AI & GEO)]       ──> llms.txt / Semantic Deep Structure / Search Engine Submissions
```

---

## 🔴 หมวดที่ 1: แก้ไข Core SEO & Content (เร่งด่วนที่สุดสำหรับ Top 10)

### 1.1 เพิ่ม Meta Description
* **ปัญหา:** ไม่พบ `<meta name="description">` บนหน้าเว็บ ทำให้ Google ต้องสุ่มข้อความบนหน้าเว็บมาแสดง ซึ่งลดอัตราการคลิก (CTR)
* **วิธีแก้ไข:** เพิ่ม Tag ต่อไปนี้ใน `<head>` ของไฟล์ HTML หน้าหลัก
```html
<meta name="description" content="คลังข้อมูลงานวิจัยมหาวิทยาลัย ค้นหางานวิจัย นวัตกรรม วิทยานิพนธ์ และบทความวิชาการจากนักศึกษาและบุคลากร ครอบคลุมวิทยาการคอมพิวเตอร์ วิศวกรรมศาสตร์ และบริหารธุรกิจ">
```

### 1.2 เพิ่ม Canonical Tag
* **ปัญหา:** ไม่มี Tag กำหนด URL หลัก (`<link rel="canonical">`) เสี่ยงโดน Google มองว่าเป็น Duplicate Content
* **วิธีแก้ไข:** ใส่ Code ต่อไปนี้ใน `<head>`
```html
<link rel="canonical" href="https://udvc-research.online/">
```

### 1.3 ปรับปรุง Title Tag และแก้ H1 ซ้ำซ้อน
* **ปัญหาปัจจุบัน:** Title ยาวเพียง 20 ตัวอักษร ("ระบบสืบค้นผลงานวิจัย") ซึ่งสั้นเกินไป และซ้ำกับ H1 Tag อีกด้วย
* **วิธีแก้ไข:**
  1. เปลี่ยน `<title>` ให้มีความยาว 30-60 ตัวอักษร พร้อม Keyword หลัก
  2. ปรับโครงสร้าง Headings ให้มี `<h1>` เพียง **1 จุด** ต่อหน้าเว็บ

```html
<!-- ในส่วน <head> -->
<title>คลังข้อมูลงานวิจัยมหาวิทยาลัย ระบบสืบค้นผลงานวิชาการและนวัตกรรม</title>

<!-- ในส่วน <body> -->
<!-- เปลี่ยน H1 จุดแรกให้เป็น H1 หลักจุดเดียวของหน้า -->
<h1 class="site-title">คลังข้อมูลงานวิจัยมหาวิทยาลัย</h1>

<!-- เปลี่ยน H1 จุดที่สอง (ระบบสืบค้นผลงานวิจัย) ให้เป็น H2 หรือ Span Styling -->
<h2 class="search-section-title">ระบบสืบค้นผลงานวิจัยและวิทยานิพนธ์</h2>
```

---

### 1.4 แก้ไขปัญหา Thin Content & Text-to-HTML Ratio
* **ปัญหา:** หน้าแรกมีเนื้อหาเพียง 24 คำ (Word Count: 24) และอัตราส่วนข้อความต่อ HTML เพียง 4.6% (แนะนำอย่างน้อย 300 คำ และ Ratio > 10%) Google จะมองว่าหน้านี้ไม่มีคุณค่าเพียงพอจะติด Top 10
* **กลยุทธ์แก้ไข:** เพิ่มเนื้อหาบรรยาย (Text Content) ในหน้าแรก เช่น:
  1. **Intro Section:** บทความแนะนำพันธกิจคลังงานวิจัย (100-150 คำ)
  2. **Featured Categories:** คำอธิบายสั้นๆ ของแต่ละสาขาวิชา (วิทยาการคอมพิวเตอร์, วิศวกรรมศาสตร์, บริหารธุรกิจ, เทคโนโลยีสารสนเทศ, มัลติมีเดีย, เครือข่าย)
  3. **FAQ Section:** คำถามที่พบบ่อยเกี่ยวกับการเข้าถึงงานวิจัยและการตีพิมพ์ (150-200 คำ)
  4. **Recent Research Highlights:** สรุปย่อผลงานวิจัยเด่นล่าสุด

---

## 🛡️ หมวดที่ 2: แก้ไข Security & HTTP Headers (คะแนน 84 -> 100)

ระบบเว็บขาด Security Headers สำคัญ 6 ตัว ซึ่งส่งผลต่อความน่าเชื่อถือและความปลอดภัยข้อมูล

### 2.1 ตัวอย่างการตั้งค่า Security Headers สำหรับ Nginx Server
หากใช้ Nginx ให้แก้ไขไฟล์ Config (`/etc/nginx/sites-available/default` หรือ `nginx.conf`):

```nginx
server {
    listen 443 ssl http2;
    server_name udvc-research.online;

    # 1. HSTS (Strict-Transport-Security) - เพิ่ม includeSubDomains และ preload
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # 2. X-Frame-Options (ป้องกัน Clickjacking)
    add_header X-Frame-Options "SAMEORIGIN" always;

    # 3. X-Content-Type-Options (ป้องกัน MIME-sniffing)
    add_header X-Content-Type-Options "nosniff" always;

    # 4. Referrer-Policy (ควบคุมการส่งข้อมูล Referrer)
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 5. Permissions-Policy (จำกัดการเข้าถึงฟีเจอร์เบราว์เซอร์)
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=()" always;

    # 6. Content-Security-Policy (CSP)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self';" always;
}
```

### 2.2 ตัวอย่างการตั้งค่าสำหรับ Node.js / Express (ผ่าน Helmet.js)
```javascript
const express = require('express');
const helmet = require('helmet');
const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
  })
);
```

---

## 📱 หมวดที่ 3: แก้ไข Social Meta Tags (Open Graph & Twitter Cards)

ปัจจุบันคะแนนหมวด Social อยู่ที่เพียง **33/100** เมื่อนำ URL ไปแชร์บน Facebook, LINE, Twitter จะไม่แสดงรูปภาพและข้อความพรีวิว

### คัดลอก Code นี้ไปวางใน `<head>` ของไฟล์ HTML:

```html
<!-- Open Graph / Facebook / LINE -->
<meta property="og:type" content="website">
<meta property="og:url" content="https://udvc-research.online/">
<meta property="og:title" content="คลังข้อมูลงานวิจัยมหาวิทยาลัย | สืบค้นงานวิจัยและนวัตกรรม">
<meta property="og:description" content="ค้นพบผลงานวิจัย นวัตกรรม และองค์ความรู้ใหม่ๆ จากนักศึกษาและบุคลากรมหาวิทยาลัย แหล่งรวมทรัพยากรทางวิชาการที่เชื่อถือได้">
<meta property="og:image" content="https://udvc-research.online/assets/images/og-cover.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="th_TH">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:url" content="https://udvc-research.online/">
<meta name="twitter:title" content="คลังข้อมูลงานวิจัยมหาวิทยาลัย | สืบค้นงานวิจัยและนวัตกรรม">
<meta name="twitter:description" content="ค้นพบผลงานวิจัย นวัตกรรม และองค์ความรู้ใหม่ๆ จากนักศึกษาและบุคลากรมหาวิทยาลัย">
<meta name="twitter:image" content="https://udvc-research.online/assets/images/og-cover.jpg">
```

---

## 🏛️ หมวดที่ 4: ยกระดับ E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)

Google ให้ความสำคัญกับปัจจัย E-E-A-T สูงมากสำหรับเว็บการศึกษาและงานวิจัย คะแนนปัจจุบันอยู่ที่ **60/100**

### สิ่งที่ต้องทำทันที:
1. **สร้าง Footer Links ให้ครบถ้วน:**
   - [ ] หน้า **เกี่ยวกับเรา (About Us):** อธิบายวัตถุประสงค์ของคลังวิจัย สถาบันต้นสังกัด
   - [ ] หน้า **ติดต่อเรา (Contact Us):** เพิ่มที่อยู่จริง (Physical Address), เบอร์โทรศัพท์, อีเมลสถาบัน
   - [ ] หน้า **นโยบายความเป็นส่วนตัว (Privacy Policy)**
   - [ ] หน้า **ข้อตกลงและเงื่อนไขการใช้งาน (Terms of Service)**
   - [ ] หน้า **นโยบายบรรณาธิการ / การคุ้มครองลิขสิทธิ์ (Editorial Policy / Copyright)**

2. **เพิ่มข้อมูลผู้เขียน/นักวิจัย (Author Byline & Credentials):**
   - ในหน้าแสดงผลงานวิจัยแต่ละเล่ม ต้องมีชื่อผู้วิจัย, อาจารย์ที่ปรึกษา, สาขาวิชา, วันที่เผยแพร่ (Publication Date), และไฟล์ PDF / External Citation อ้างอิง

---

## 🏷️ หมวดที่ 5: ติดตั้ง Structured Data (Schema.org JSON-LD)

เพื่อช่วยให้ Google เข้าใจโครงสร้างข้อมูลและสร้าง **Sitelinks Search Box** บนผลการค้นหา

### วาง Code นี้ใน `<head>` ของหน้าหลัก:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://udvc-research.online/#website",
      "url": "https://udvc-research.online/",
      "name": "คลังข้อมูลงานวิจัยมหาวิทยาลัย",
      "description": "ระบบสืบค้นผลงานวิจัย นวัตกรรม และวิทยานิพนธ์",
      "inLanguage": "th",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://udvc-research.online/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "EducationalOrganization",
      "@id": "https://udvc-research.online/#organization",
      "name": "คลังข้อมูลงานวิจัยมหาวิทยาลัย",
      "url": "https://udvc-research.online/",
      "logo": "https://udvc-research.online/assets/images/logo.png"
    }
  ]
}
</script>
```

---

## ⚡ หมวดที่ 6: ปรับปรุง Performance & Accessibility

### 6.1 Font Optimization (Google Fonts)
* **ปัญหา:** Google Fonts ขาดพารามิเตอร์ `display=swap`
* **วิธีแก้ไข:** ปรับเปลี่ยน URL ของ Google Fonts ใน HTML:
```html
<!-- ก่อนแก้ -->
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700" rel="stylesheet">

<!-- หลังแก้ (เพิ่ม &display=swap และ rel="preconnect") -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
```

### 6.2 เปิดใช้งาน Brotli / Gzip Text Compression
ปรับแต่งใน Nginx ให้บีบอัด HTML, CSS, JS:
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

### 6.3 เพิ่ม Accessibility Labels & Skip Navigation
1. **Skip Navigation Link:**
```html
<a href="#main-content" class="skip-link">ข้ามไปที่เนื้อหาหลัก</a>
```
2. **Form Input Labels:**
```html
<!-- เพิ่ม label ให้ช่องค้นหา -->
<label for="search-input" class="sr-only">ค้นหาหัวข้อวิจัย หรือคำสำคัญ</label>
<input type="text" id="search-input" name="q" placeholder="พิมพ์หัวเรื่อง หรือคำสำคัญ...">
```

---

## 🤖 หมวดที่ 7: AI & GEO Readiness (Generative Engine Optimization)

เพื่อรองรับการดึงข้อมูลของ AI Search Engine เช่น ChatGPT, Perplexity, Claude และ Gemini

### สร้างไฟล์ `llms.txt` ไว้ที่ Root Directory (`https://udvc-research.online/llms.txt`):

```text
# UDVC Research Portal - Academic Research Repository

> คลังข้อมูลงานวิจัยมหาวิทยาลัย แหล่งรวบรวมงานวิจัย นวัตกรรม และวิทยานิพนธ์ระดับอุดมศึกษา

## Academic Categories
- Computer Science & AI (วิทยาการคอมพิวเตอร์และปัญญาประดิษฐ์)
- Engineering (วิศวกรรมศาสตร์)
- Business Administration (บริหารธุรกิจ)
- Information Technology (เทคโนโลยีสารสนเทศ)
- Multimedia & Digital Media (มัลติมีเดีย)
- Network & Cybersecurity (เครือข่ายและความปลอดภัย)

## Key Pages
- Research Search Portal: https://udvc-research.online/
- Latest Research: https://udvc-research.online/#latest
```

---

## 📋 Checklist ตรวจสอบสรุปก่อนส่งมอบงาน (Verification Checklist)

- [ ] 1. เพิ่ม `<meta name="description">` และ `<link rel="canonical">`
- [ ] 2. ปรับ `<title>` ให้ยาว 30-60 ตัวอักษร และเหลือ `<h1>` เพียงจุดเดียว
- [ ] 3. เพิ่มเนื้อหาบทความหน้าแรกให้เกิน 300 คำ
- [ ] 4. ติดตั้ง HTTP Security Headers ทั้ง 6 ตัวใน Nginx/Server
- [ ] 5. ใส่ Open Graph (og:) และ Twitter Card Meta Tags ให้ครบถ้วน
- [ ] 6. สร้างลิงก์เกี่ยวกับเรา, ติดต่อเรา, นโยบายความเป็นส่วนตัว ที่ Footer
- [ ] 7. ใส่ Schema.org JSON-LD สำหรับ WebSite และ SearchAction
- [ ] 8. เติม `&display=swap` ให้ Google Fonts และเปิดใช้งาน Gzip/Brotli
- [ ] 9. เพิ่ม `label` ให้ช่อง Form และใส่ `aria-label` ให้ปุ่มที่ไม่มีข้อความ
- [ ] 10. สร้างไฟล์ `llms.txt` และยื่น `sitemap.xml` ใน Google Search Console

---
*จัดทำแผนงานสำหรับ udvc-research.online เพื่อเป้าหมายการติด Top 10 Google Search*
