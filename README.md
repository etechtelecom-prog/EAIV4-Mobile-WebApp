# EAIV4 Operations Dashboard

แดชบอร์ดนี้อ่านข้อมูลจาก Apps Script API เดิมด้วย:

`?action=list&limit=500`

และใช้คอลัมน์ `photo_url` ในชีต `events` เพื่อแสดงจำนวนรูป ลิงก์ และภาพตัวอย่าง

## การติดตั้งบน GitHub Pages

1. สร้าง Repository ใหม่ เช่น `EAIV4-Dashboard`
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้
3. ไปที่ Settings → Pages
4. Source: Deploy from a branch
5. Branch: `main` และโฟลเดอร์ `/root`
6. เปิด URL ที่ GitHub Pages สร้างให้

## จุดตรวจสอบใน Google Sheet

เลื่อนไปทางขวา จะพบคอลัมน์:
- `photo_url`
- `device`

คอลัมน์ `photo_url` จะมี URL หลายรายการ แยกด้วยการขึ้นบรรทัดใหม่

## หมายเหตุเรื่องสิทธิ์รูป

Code.gs เดิมเก็บรูปเป็น Private เพื่อคุ้มครองข้อมูลภาคสนาม

- ผู้ใช้ที่มีสิทธิ์ใน Google Drive จะเปิดลิงก์ได้
- ภาพตัวอย่างบน Dashboard อาจไม่แสดง หากเบราว์เซอร์ไม่ได้ล็อกอินบัญชีที่มีสิทธิ์
- ไม่ควรตั้งไฟล์เป็น Public โดยอัตโนมัติ หากรูปมีข้อมูลบุคคลหรือข้อมูลอ่อนไหว


## V2.2: photos_json เป็นแหล่งข้อมูลหลัก

Dashboard จะอ่าน `photos_json` ก่อน ตัวอย่าง:

```json
[
  {
    "index": 1,
    "name": "EAI_820702_88888_20260720_225002_01.jpg",
    "id": "FILE_ID",
    "thumbnail": "https://drive.google.com/thumbnail?id=FILE_ID&sz=w600",
    "url": "https://drive.google.com/file/d/FILE_ID/view"
  }
]
```

ถ้าแถวเก่ายังไม่มี `photos_json` ระบบจะ fallback ไปอ่าน:
`photo_name`, `photo_ids`, `photo_url`, `thumbnail_url` อัตโนมัติ
