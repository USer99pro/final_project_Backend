# AI Development Specification — Research Analytics Dashboard

## 1. วัตถุประสงค์

เอกสารนี้ใช้เป็นข้อกำหนดสำหรับ AI/Coding Agent ในการพัฒนา **Research Analytics Dashboard** ของระบบสืบค้นผลงานวิจัยนักศึกษาระดับปริญญาตรี ครอบคลุมทั้ง Backend และ Frontend

เป้าหมายคือเปลี่ยน Dashboard จากการแสดงตัวเลขแบบ CRUD ทั่วไป ให้เป็นระบบ **Research Analytics** ที่สามารถ:

- สรุปข้อมูลผลงานวิจัย
- วิเคราะห์ข้อมูลตามช่วงเวลา
- วิเคราะห์แนวโน้ม
- วิเคราะห์สาขาวิชา หมวดหมู่ และ Keyword
- วิเคราะห์พฤติกรรมการค้นหาและการเข้าชม
- แสดง Research Insights
- รองรับการกรองข้อมูลแบบ Dynamic
- ใช้ข้อมูลจริงจาก MongoDB และ API
- ไม่สร้างข้อมูล Mock เพื่อแสดงผลแทนข้อมูลจริงใน Production

---

# PART A — BACKEND

## 2. Backend Technology

ให้ตรวจสอบและใช้ Technology Stack เดิมของโปรเจกต์ก่อน ห้ามเปลี่ยน Stack โดยไม่จำเป็น

คาดหวัง:

- Node.js
- Express.js
- MongoDB
- Mongoose
- REST API
- Axios หรือ HTTP client ฝั่ง Frontend
- Authentication/Authorization ที่มีอยู่เดิม
- JavaScript

ก่อนแก้ไข Backend ให้ตรวจสอบ:

1. โครงสร้างโฟลเดอร์
2. Models
3. Controllers
4. Routes
5. Middleware
6. Authentication
7. MongoDB connection
8. รูปแบบ Response ของ API เดิม

ต้องรักษา Compatibility กับ API เดิม

---

# 3. Data Model ที่เกี่ยวข้อง

ตรวจสอบว่าระบบมีข้อมูลต่อไปนี้แล้วหรือไม่:

- users
- works
- categories
- subcategories
- tags
- departments/programs
- academic years

หากมีอยู่แล้ว ให้ Reuse Model เดิม ไม่สร้าง Collection ซ้ำโดยไม่จำเป็น

ควรเพิ่มระบบเก็บ Analytics Logs ตามความเหมาะสม:

- search_logs
- view_logs
- download_logs

---

# 4. Search Log

สร้าง Model สำหรับเก็บข้อมูลการค้นหา

ตัวอย่าง:

```js
{
  keyword: String,
  normalizedKeyword: String,
  userId: ObjectId | null,
  resultsCount: Number,
  filters: {
    academicYear: String | null,
    department: String | null,
    category: String | null,
    type: String | null
  },
  createdAt: Date
}
```

ข้อกำหนด:

- `userId` ต้องรองรับผู้ใช้ที่ไม่ได้ Login
- ไม่ควรเก็บข้อมูลส่วนตัวเกินความจำเป็น
- Normalize Keyword ก่อนบันทึกเพื่อให้วิเคราะห์ได้ง่าย
- เพิ่ม Index สำหรับ `createdAt`, `normalizedKeyword` และ fields ที่ใช้ Aggregation บ่อย

---

# 5. View Log

สร้าง Model สำหรับบันทึกการเปิดดูผลงาน

```js
{
  workId: ObjectId,
  userId: ObjectId | null,
  createdAt: Date
}
```

ควรใช้ Index:

```text
workId
createdAt
userId
```

---

# 6. Download Log

หากระบบรองรับ Download ให้เก็บ:

```js
{
  workId: ObjectId,
  userId: ObjectId | null,
  createdAt: Date
}
```

ใช้สำหรับวิเคราะห์ผลงานที่ได้รับความสนใจ

---

# 7. Analytics API

สร้าง API สำหรับ Dashboard โดยควรแยก Controller/Service สำหรับ Analytics

แนะนำโครงสร้าง:

```text
controllers/
  analyticsController.js

services/
  analyticsService.js

routes/
  analyticsRoutes.js

models/
  SearchLog.js
  ViewLog.js
  DownloadLog.js
```

หากโปรเจกต์มีโครงสร้างแตกต่าง ให้ใช้ Pattern เดิมของโปรเจกต์แทน

---

# 8. API ที่ต้องรองรับ

## 8.1 Overview

```http
GET /api/admin/analytics/overview
```

Response ควรมี:

```json
{
  "totalWorks": 0,
  "totalStudents": 0,
  "totalDepartments": 0,
  "totalViews": 0,
  "totalSearches": 0,
  "latestAcademicYear": null,
  "growth": {
    "works": 0,
    "views": 0,
    "searches": 0
  }
}
```

---

## 8.2 Works Trend

```http
GET /api/admin/analytics/works-trend
```

Query:

```text
academicYear
department
category
type
startYear
endYear
```

Response:

```json
{
  "data": [
    {
      "year": "2565",
      "count": 120
    },
    {
      "year": "2566",
      "count": 185
    }
  ]
}
```

---

## 8.3 Works by Department

```http
GET /api/admin/analytics/works-by-department
```

Response:

```json
{
  "data": [
    {
      "name": "เทคโนโลยีสารสนเทศ",
      "count": 320
    }
  ]
}
```

---

## 8.4 Works by Category

```http
GET /api/admin/analytics/works-by-category
```

---

## 8.5 Works by Type

```http
GET /api/admin/analytics/works-by-type
```

---

## 8.6 Popular Keywords

```http
GET /api/admin/analytics/popular-keywords
```

Query:

```text
limit=10
startDate
endDate
department
academicYear
```

Response:

```json
{
  "data": [
    {
      "keyword": "AI",
      "count": 184
    }
  ]
}
```

---

## 8.7 Keyword Trend

```http
GET /api/admin/analytics/keyword-trend
```

Query:

```text
keyword
startYear
endYear
```

Response:

```json
{
  "keyword": "AI",
  "data": [
    {
      "year": "2566",
      "count": 20
    },
    {
      "year": "2567",
      "count": 35
    }
  ]
}
```

---

## 8.8 Popular Searches

```http
GET /api/admin/analytics/popular-searches
```

แสดง Keyword ที่ผู้ใช้ค้นหาบ่อยที่สุด

---

## 8.9 Popular Works

```http
GET /api/admin/analytics/popular-works
```

ควรสามารถเรียงตาม:

- views
- downloads
- recent activity

---

## 8.10 Usage Trend

```http
GET /api/admin/analytics/usage-trend
```

แสดง:

- searches
- views
- downloads

ตามวัน/เดือน

---

## 8.11 Research Insights

```http
GET /api/admin/analytics/insights
```

Backend ควรคำนวณข้อมูลสำหรับ Insight เช่น:

- จำนวนผลงานเพิ่ม/ลดกี่ %
- สาขาที่มีผลงานมากที่สุด
- Keyword ยอดนิยม
- Keyword ที่เติบโตเร็ว
- ผลงานที่ได้รับความสนใจสูงสุด

ไม่จำเป็นต้องใช้ LLM ในขั้นแรก สามารถคำนวณจากข้อมูลเชิงสถิติได้

---

# 9. MongoDB Aggregation

ให้ใช้ MongoDB Aggregation Pipeline สำหรับข้อมูล Analytics ที่เหมาะสม

ตัวอย่าง:

```js
[
  {
    $match: {
      status: "approved"
    }
  },
  {
    $group: {
      _id: "$academicYear",
      count: {
        $sum: 1
      }
    }
  },
  {
    $sort: {
      _id: 1
    }
  }
]
```

ข้อกำหนด:

- Filter ข้อมูลก่อน `$group` เมื่อทำได้
- ใช้ Index
- หลีกเลี่ยงการโหลดข้อมูลทั้งหมดมา `find()` แล้วคำนวณใน Node.js
- ตรวจสอบ Performance
- ใช้ `$lookup` เฉพาะเมื่อจำเป็น
- จำกัดจำนวนข้อมูลสำหรับ Top N

---

# 10. Security

Analytics API ต้องมี Authorization

เฉพาะ Role ที่ได้รับอนุญาต เช่น:

```text
admin
staff
```

ต้องตรวจสอบ Middleware เดิมของโปรเจกต์ก่อนสร้างใหม่

ห้ามเปิด Analytics API ให้ Public โดยไม่ตั้งใจ

---

# 11. Error Handling

ทุก API ต้องมีมาตรฐาน Response เดียวกับ Backend เดิม

กรณี Error:

```json
{
  "success": false,
  "message": "ไม่สามารถโหลดข้อมูล Analytics ได้"
}
```

ห้ามส่ง Stack Trace หรือข้อมูลลับไปยัง Client ใน Production

---

# 12. Backend Performance

ต้องคำนึงถึง:

- MongoDB Index
- Aggregation
- Pagination สำหรับรายการ
- Limit ของ Top N
- Date filtering
- Caching หากข้อมูลมีปริมาณมาก
- ไม่ Query Database ซ้ำโดยไม่จำเป็น

หาก Analytics มี Query ซ้ำจำนวนมาก ให้พิจารณา Service/Caching Layer

---

# PART B — FRONTEND

# 13. Frontend Technology

ใช้ Technology เดิมของโปรเจกต์:

- React
- Vite
- JavaScript
- JSX
- TailwindCSS
- Axios
- React Router

ห้ามเปลี่ยนเป็น TypeScript หรือ Framework ใหม่โดยไม่จำเป็น

---

# 14. Dashboard Page

สร้างหรือปรับปรุงหน้า:

```text
Admin Dashboard
```

แนะนำ Component Structure:

```text
components/
  dashboard/
    StatCard.jsx
    DashboardFilters.jsx
    WorksTrendChart.jsx
    WorksByDepartmentChart.jsx
    WorksByCategoryChart.jsx
    WorksByTypeChart.jsx
    PopularKeywords.jsx
    KeywordTrendChart.jsx
    PopularSearches.jsx
    PopularWorks.jsx
    UsageTrendChart.jsx
    ResearchInsights.jsx
```

หากโปรเจกต์มี Component Pattern อยู่แล้ว ให้ใช้ Pattern เดิม

---

# 15. Dashboard Layout

ต้องออกแบบ Responsive

Desktop:

```text
┌──────────────────────────────────────────────┐
│ Dashboard Header                             │
├──────────────────────────────────────────────┤
│ Filters                                      │
├────────┬────────┬────────┬────────┬─────────┤
│ Works  │ Users  │ Dept.  │ Views  │ Search  │
├────────┴────────┴────────┴────────┴─────────┤
│ Works Trend                                  │
├──────────────────────┬───────────────────────┤
│ By Department        │ By Category/Type      │
├──────────────────────┴───────────────────────┤
│ Popular Keywords                             │
├──────────────────────┬───────────────────────┤
│ Search Analytics     │ Popular Works         │
├──────────────────────┴───────────────────────┤
│ Research Insights                            │
└──────────────────────────────────────────────┘
```

Mobile ต้องเปลี่ยนเป็น Single Column

---

# 16. Dashboard Header

แสดง:

```text
Research Analytics
ภาพรวมและการวิเคราะห์ผลงานวิจัย
```

และคำอธิบายสั้น ๆ

```text
วิเคราะห์ข้อมูลผลงานวิจัย แนวโน้ม และพฤติกรรมการใช้งานระบบ
```

---

# 17. Global Filters

สร้าง Filter ที่ใช้ร่วมกับ Dashboard

ประกอบด้วย:

```text
ปีการศึกษา
สาขาวิชา
หมวดหมู่
ประเภทผลงาน
ช่วงเวลา
```

เมื่อ Filter เปลี่ยน:

- API ต้องถูกเรียกใหม่
- Chart ต้อง Update
- KPI ต้อง Update
- Insight ต้อง Update

ควรใช้ Query Parameters

ตัวอย่าง:

```text
?academicYear=2569
&department=IT
&category=research
```

---

# 18. KPI Cards

สร้าง Card สำหรับ:

1. ผลงานทั้งหมด
2. นักศึกษาทั้งหมด
3. สาขาวิชา
4. การเข้าชม
5. การค้นหา

แต่ละ Card ควรมี:

- Icon
- Label
- Value
- Comparison
- Trend
- Loading State

ตัวอย่าง:

```text
📚 ผลงานทั้งหมด
1,248

↑ 12.5%
จากปีที่ผ่านมา
```

---

# 19. Works Trend Chart

ใช้ Line Chart

แสดง:

```text
X = ปีการศึกษา
Y = จำนวนผลงาน
```

ต้องรองรับ:

- Tooltip
- Responsive
- Empty State
- Loading State
- Filter
- Error State

ห้าม Hardcode ตัวเลข

---

# 20. Works by Department

ใช้ Bar Chart

แสดง Top Departments และสามารถเรียงจากมากไปน้อย

ต้องรองรับชื่อภาษาไทยที่ยาว

---

# 21. Works by Category / Type

ใช้ Donut Chart หรือ Pie Chart

ต้องแสดง:

- Label
- Count
- Percentage
- Tooltip

ไม่ควรใช้ Pie Chart หากมี Category มากเกินไปจนอ่านยาก

---

# 22. Popular Keywords

แสดง Top 10

ตัวอย่าง:

```text
AI                         184
ระบบสารสนเทศ               156
การตลาดออนไลน์             142
เทคโนโลยี                   118
```

ควรมี:

- Rank
- Keyword
- Count
- Percentage

---

# 23. Keyword Trend

ผู้ใช้สามารถเลือก Keyword

```text
Keyword
[AI ▼]
```

แล้วแสดง Line Chart ตามปี

เช่น:

```text
2566 → 20
2567 → 35
2568 → 70
2569 → 110
```

---

# 24. Popular Searches

แสดงคำค้นหาที่ผู้ใช้ค้นหามากที่สุด

Columns:

```text
อันดับ
Keyword
จำนวนครั้ง
แนวโน้ม
```

สามารถใช้ Badge:

```text
↑ เพิ่มขึ้น
↓ ลดลง
→ คงที่
```

---

# 25. Popular Works

แสดงผลงานที่ได้รับความสนใจสูงสุด

ข้อมูล:

```text
ชื่อผลงาน
ผู้จัดทำ
สาขาวิชา
ปีการศึกษา
Views
Downloads
```

ควรมี Link ไปยังหน้า Detail ของผลงาน

---

# 26. Usage Analytics

แสดงการใช้งานระบบตามเวลา

ข้อมูล:

```text
Searches
Views
Downloads
```

ใช้ Line Chart หรือ Area Chart

ต้องมี Filter:

```text
7 วัน
30 วัน
3 เดือน
6 เดือน
1 ปี
```

---

# 27. Research Insights

สร้าง Component:

```text
ResearchInsights.jsx
```

แสดงข้อความที่คำนวณจาก API

ตัวอย่าง:

```text
📈 แนวโน้มผลงาน

ผลงานวิจัยเพิ่มขึ้น 26.3%
เมื่อเปรียบเทียบกับปีที่ผ่านมา
```

```text
🔥 หัวข้อยอดนิยม

AI เป็น Keyword ที่ได้รับความสนใจสูงสุด
```

```text
🏆 สาขาที่มีผลงานมากที่สุด

สาขาวิชาเทคโนโลยีสารสนเทศ
```

Insight ต้องมาจากข้อมูลจริง

ห้าม Hardcode ตัวเลข

---

# 28. Loading State

ทุก Component ต้องมี Loading State

แนะนำ Skeleton Loading

ห้ามแสดง:

```text
0
```

ระหว่างที่ API กำลังโหลด เพราะผู้ใช้อาจเข้าใจว่าข้อมูลเป็นศูนย์

---

# 29. Empty State

กรณีไม่มีข้อมูล:

```text
ไม่พบข้อมูล
ลองเปลี่ยนตัวกรองหรือช่วงเวลาที่เลือก
```

ห้ามแสดง Chart ว่างโดยไม่มีคำอธิบาย

---

# 30. Error State

หาก API Error:

```text
ไม่สามารถโหลดข้อมูลได้

[ลองอีกครั้ง]
```

ต้องรองรับ Retry

---

# 31. Responsive Design

ต้องรองรับ:

- Desktop
- Laptop
- Tablet
- Mobile

Breakpoints ต้องสอดคล้องกับ TailwindCSS ของโปรเจกต์

หลีกเลี่ยง:

- Horizontal overflow
- Text ถูกตัด
- Chart เล็กเกินไป
- Card ล้นหน้าจอ
- Table ล้นบน Mobile

---

# 32. UI/UX

ใช้ Design System เดิมของโปรเจกต์

แนวทาง:

- Clean
- Modern
- Professional
- อ่านง่าย
- เหมาะกับระบบสถาบันการศึกษา
- ใช้ Card อย่างพอดี
- มี Visual Hierarchy ชัดเจน
- ไม่ใช้สีมากเกินไป
- ใช้สีสำหรับสถานะและ Trend อย่างมีความหมาย

ปุ่มและข้อความต้องมี Contrast ที่อ่านง่าย

---

# 33. Accessibility

ต้องคำนึงถึง:

- Color Contrast
- Keyboard Navigation
- Button Label
- Tooltip
- aria-label สำหรับ Icon-only button
- Chart ต้องมีข้อความสรุปเมื่อเหมาะสม

ห้ามใช้สีเพียงอย่างเดียวเพื่อสื่อความหมาย

---

# 34. API Service ฝั่ง Frontend

ควรแยก API Service

ตัวอย่าง:

```text
services/
  analyticsService.js
```

เช่น:

```js
getOverview(params)
getWorksTrend(params)
getWorksByDepartment(params)
getWorksByCategory(params)
getPopularKeywords(params)
getKeywordTrend(params)
getPopularSearches(params)
getPopularWorks(params)
getUsageTrend(params)
getInsights(params)
```

ไม่ควรเขียน Axios Request กระจายอยู่ใน Component จำนวนมาก

---

# 35. State Management

Dashboard ต้องจัดการ:

```text
filters
loading
error
overview
trend
departmentData
categoryData
typeData
keywords
keywordTrend
popularSearches
popularWorks
usageTrend
insights
```

ถ้าโปรเจกต์มี Context หรือ State Management อยู่แล้ว ให้ใช้ของเดิม

---

# 36. Data Fetching

ควรหลีกเลี่ยงการ Request API ทีละตัวแบบ Sequential หาก API ไม่ได้ขึ้นต่อกัน

สามารถโหลดข้อมูลอิสระพร้อมกันได้ เช่น:

```js
Promise.all([
  getOverview(params),
  getWorksTrend(params),
  getWorksByDepartment(params),
  getPopularKeywords(params)
])
```

ต้องจัดการ Error แยกตามความเหมาะสม

---

# 37. Date Handling

ต้องระวังความแตกต่างระหว่าง:

- ปี ค.ศ.
- ปี พ.ศ.
- ปีการศึกษา

หากระบบใช้ปีการศึกษา พ.ศ. ให้ใช้ Format ที่ตรงกับข้อมูลจริง

อย่าแปลงปีโดยอัตโนมัติโดยไม่ตรวจสอบ Logic เดิมของระบบ

---

# 38. การคำนวณ Growth

Growth Rate:

```text
((Current - Previous) / Previous) × 100
```

กรณี Previous = 0 ต้องป้องกัน Division by Zero

ตัวอย่าง:

```text
Previous = 0
Current = 20

Growth = N/A
```

ไม่ควรแสดง Infinity

---

# 39. Trending Topic

กำหนดแนวโน้มจากข้อมูลย้อนหลัง เช่น:

```text
Current Period
vs
Previous Period
```

ตัวอย่าง:

```text
AI

ช่วงก่อนหน้า = 50
ช่วงปัจจุบัน = 80

Growth = +60%
```

สามารถจัดอันดับ Trending Topics ตาม Growth Rate

แต่ควรกำหนด Minimum Count เพื่อป้องกันหัวข้อที่มีข้อมูลน้อยผิดปกติ เช่น:

```text
minimumCount >= 5
```

---

# 40. สิ่งที่ AI ต้องตรวจสอบก่อนแก้ไขโค้ด

ก่อนเขียนหรือแก้ไขโค้ด ให้ AI:

1. ตรวจสอบโครงสร้างโปรเจกต์ Backend
2. ตรวจสอบโครงสร้างโปรเจกต์ Frontend
3. ตรวจสอบ Models
4. ตรวจสอบ API Routes
5. ตรวจสอบ Authentication
6. ตรวจสอบ Dashboard เดิม
7. ตรวจสอบ Axios/API Service
8. ตรวจสอบ Chart Library ที่ติดตั้งอยู่
9. ตรวจสอบ TailwindCSS Configuration
10. ตรวจสอบข้อมูลจริงใน MongoDB Schema

ห้ามสร้างไฟล์ซ้ำกับไฟล์เดิมโดยไม่จำเป็น

---

# 41. กฎสำคัญในการแก้ไข

## ห้าม

- Hardcode จำนวนผลงาน
- Hardcode Keyword
- Hardcode Chart Data
- สร้าง Mock Data แล้วใช้แทน Database ใน Production
- เปลี่ยน Database โดยไม่จำเป็น
- เปลี่ยน API เดิมโดยทำให้ Feature เดิมพัง
- ลบ Authentication
- ลบ Feature เดิม
- เปลี่ยน Technology Stack โดยไม่มีเหตุผล
- ทำให้ Responsive เดิมเสีย

## ต้อง

- ใช้ข้อมูลจริงจาก MongoDB
- ใช้ API จริง
- Reuse Model เดิม
- Reuse Authentication เดิม
- Reuse Component/Style เดิมเมื่อเหมาะสม
- รองรับ Loading
- รองรับ Empty State
- รองรับ Error
- รองรับ Responsive
- ตรวจสอบ Console Error
- ตรวจสอบ Network Error
- ตรวจสอบ Build Error

---

# 42. Testing

หลังพัฒนา Backend:

```text
[ ] API Overview ทำงาน
[ ] API Works Trend ทำงาน
[ ] API Department ทำงาน
[ ] API Category ทำงาน
[ ] API Type ทำงาน
[ ] API Keywords ทำงาน
[ ] API Keyword Trend ทำงาน
[ ] API Popular Searches ทำงาน
[ ] API Popular Works ทำงาน
[ ] API Usage Trend ทำงาน
[ ] API Insights ทำงาน
[ ] Authentication ทำงาน
[ ] Authorization ทำงาน
[ ] MongoDB Aggregation ไม่ Error
```

หลังพัฒนา Frontend:

```text
[ ] Dashboard โหลดข้อมูลได้
[ ] KPI ถูกต้อง
[ ] Charts แสดงข้อมูลจริง
[ ] Filters ทำงาน
[ ] เปลี่ยน Filter แล้วข้อมูล Update
[ ] Loading State ทำงาน
[ ] Empty State ทำงาน
[ ] Error State ทำงาน
[ ] Retry ทำงาน
[ ] Responsive ทำงาน
[ ] Mobile ไม่ล้นหน้าจอ
[ ] ไม่มี Console Error
[ ] ไม่มี Network Error
[ ] npm run build ผ่าน
```

---

# 43. Definition of Done

งานถือว่าเสร็จเมื่อ:

### Backend

- มี Analytics API ที่จำเป็นครบ
- Query MongoDB จากข้อมูลจริง
- มี Index ที่เหมาะสม
- มี Authentication/Authorization
- Error Handling ถูกต้อง
- ไม่มี API เดิมพัง
- ไม่มีข้อมูล Mock ใน Production

### Frontend

- Dashboard แสดงข้อมูลจริง
- KPI ทำงาน
- Charts ทำงาน
- Filters ทำงาน
- Research Insights ทำงาน
- Loading / Empty / Error State ครบ
- Responsive
- UI สอดคล้องกับระบบเดิม
- ไม่มี Console Error
- Build สำเร็จ

---

# 44. เป้าหมายสุดท้าย

Dashboard ต้องสามารถเปลี่ยนข้อมูลดิบ:

```text
Works
Users
Categories
Keywords
Search Logs
View Logs
Download Logs
```

ให้กลายเป็น:

```text
                    DATA
                      │
                      ▼
                ANALYTICS
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       SUMMARY      TREND      BEHAVIOR
          │           │           │
          └───────────┼───────────┘
                      ▼
                  INSIGHTS
                      │
                      ▼
              USEFUL INFORMATION
```

ผลลัพธ์ที่ต้องการคือ Dashboard ที่ช่วยให้ผู้ดูแลระบบและผู้บริหารสามารถมองเห็น:

1. **ภาพรวมของผลงานวิจัย**
2. **การเปลี่ยนแปลงของผลงานในแต่ละปี**
3. **สาขาวิชาที่มีผลงานมากที่สุด**
4. **หมวดหมู่และประเภทผลงานที่ได้รับความสนใจ**
5. **Keyword ที่ได้รับความนิยม**
6. **หัวข้อที่กำลังมีแนวโน้มเพิ่มขึ้น**
7. **พฤติกรรมการค้นหาของผู้ใช้งาน**
8. **ผลงานที่ได้รับความสนใจสูงสุด**
9. **แนวโน้มการใช้งานระบบ**
10. **Research Insights จากข้อมูลจริง**

AI ต้องให้ความสำคัญกับ **ความถูกต้องของข้อมูล, ความสอดคล้องกับระบบเดิม, Performance, Security, Responsive UI และการไม่ทำลาย Feature ที่มีอยู่เดิม** เป็นอันดับแรก
