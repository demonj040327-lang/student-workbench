"""Bounded, local-only text extraction. Never executes content from a document."""
import json
import posixpath
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

MAX_PAGES = 1000
MAX_PAGE_TEXT = 32000
MAX_TOTAL_TEXT = 1500000
MAX_XML_BYTES = 2000000


def extract(path, extension):
    pages, warnings = [], []
    if extension == ".pdf":
        from pypdf import PdfReader
        reader = PdfReader(path, strict=False)
        if reader.is_encrypted and not reader.decrypt(""):
            raise ValueError("文件受密码保护，请先提供未加密版本。")
        if len(reader.pages) > MAX_PAGES:
            warnings.append("页数超过 1000；本次仅提取前 1000 页。")
        for number, page in enumerate(reader.pages[:MAX_PAGES], 1):
            try:
                text = page.extract_text() or ""
            except Exception:
                text = ""
                warnings.append(f"第 {number} 页文字提取失败，请回看原文件。")
            pages.append({"page": number, "text": text})
    elif extension in (".pptx", ".docx"):
        with zipfile.ZipFile(path) as archive:
            if len(archive.infolist()) > 20000:
                raise ValueError("压缩包包含过多条目，无法安全解析。")
            def read_xml(name):
                info = archive.getinfo(name)
                if info.file_size > MAX_XML_BYTES:
                    raise ValueError("单个文档 XML 过大，请拆分后上传。")
                return ET.fromstring(archive.read(name))
            if extension == ".pptx":
                # Part names reflect creation history, not the order visible in
                # PowerPoint. Follow sldIdLst relationships to preserve citations
                # after the user has rearranged or deleted slides.
                presentation = read_xml("ppt/presentation.xml")
                relationships = read_xml("ppt/_rels/presentation.xml.rels")
                targets = {}
                for relationship in relationships:
                    if not relationship.attrib.get("Type", "").endswith("/slide"):
                        continue
                    if relationship.attrib.get("TargetMode") == "External":
                        raise ValueError("外部幻灯片引用不支持本地解析。")
                    target = relationship.attrib.get("Target", "")
                    part = posixpath.normpath(target.lstrip("/")) if target.startswith("/") else posixpath.normpath(posixpath.join("ppt", target))
                    if not re.fullmatch(r"ppt/slides/[^/]+\.xml", part):
                        raise ValueError("幻灯片关联路径无效。")
                    targets[relationship.attrib.get("Id")] = part
                names = []
                for slide in presentation.iter():
                    if not slide.tag.endswith("}sldId"):
                        continue
                    relationship_id = next((value for key, value in slide.attrib.items() if key.endswith("}id")), None)
                    if relationship_id not in targets:
                        raise ValueError("幻灯片播放顺序关联缺失，请重新保存 PPTX 后再试。")
                    names.append(targets[relationship_id])
                if len(names) > MAX_PAGES:
                    warnings.append("幻灯片超过 1000 张；本次仅提取前 1000 张。")
                for number, name in enumerate(names[:MAX_PAGES], 1):
                    root = read_xml(name)
                    paragraphs = []
                    for paragraph in root.iter("{http://schemas.openxmlformats.org/drawingml/2006/main}p"):
                        paragraphs.append("".join(node.text or "" for node in paragraph.iter("{http://schemas.openxmlformats.org/drawingml/2006/main}t")))
                    pages.append({"page": number, "text": "\n".join(paragraphs)})
                warnings.append("PPTX 只提取幻灯片文字；图片、公式图像和动画需回到原课件查看。")
            else:
                root = read_xml("word/document.xml")
                ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
                paragraphs = ["".join(node.text or "" for node in paragraph.iter(ns + "t")) for paragraph in root.iter(ns + "p")]
                pages = text_sections("\n".join(paragraphs))
                warnings.append("DOCX 按文字段落分节；这里的页序不是 Word 排版页码。")
    elif extension in (".txt", ".md"):
        raw = Path(path).read_bytes()
        if b"\x00" in raw:
            raise ValueError("该文件不是可识别的 UTF-8 文本，请转换后再上传。")
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise ValueError("文本必须使用 UTF-8 编码，请转换后再上传。")
        pages = text_sections(text)
        warnings.append("TXT / Markdown 按段落分节；页序表示文字节序。")
    else:
        raise ValueError("目前支持 PDF、PPTX、DOCX、TXT 和 Markdown。")

    total = 0
    for item in pages:
        original = item["text"]
        clean = re.sub(r"[\t\r ]+", " ", original)
        clean = re.sub(r"\n{3,}", "\n\n", clean).strip()
        if len(clean) > MAX_PAGE_TEXT:
            warnings.append(f"第 {item['page']} 页过长，已截取前 {MAX_PAGE_TEXT} 个字符。")
        clean = clean[:MAX_PAGE_TEXT]
        available = MAX_TOTAL_TEXT - total
        if len(clean) > available:
            clean = clean[:max(0, available)]
            if "提取文字达到长度上限；未完整覆盖全文。" not in warnings:
                warnings.append("提取文字达到长度上限；未完整覆盖全文。")
        total += len(clean)
        item["text"] = clean
        item["title"] = next((line.strip(" #*•")[:120] for line in clean.splitlines() if len(line.strip()) >= 4), f"第 {item['page']} 页")
    if not any(page["text"] for page in pages):
        warnings.append("未发现可提取文字。扫描件或图片课件需要 OCR；当前版本未启用 OCR。")
    else:
        blank = sum(not page["text"] for page in pages)
        if blank:
            warnings.append(f"有 {blank} 页未提取到文字；图片内容仍需查看原课件。")
    return {"pages": pages, "warnings": warnings}


def text_sections(text):
    sections, current = [], []
    size = 0
    for paragraph in text.replace("\f", "\n\n").split("\n\n"):
        for start in range(0, max(1, len(paragraph)), 4200):
            part = paragraph[start:start + 4200]
            if current and size + len(part) > 4200:
                sections.append("\n\n".join(current))
                current, size = [], 0
            current.append(part)
            size += len(part)
    if current:
        sections.append("\n\n".join(current))
    return [{"page": number, "text": section} for number, section in enumerate(sections[:MAX_PAGES], 1)]


if __name__ == "__main__":
    try:
        result = extract(sys.argv[1], sys.argv[2])
        print(json.dumps(result, ensure_ascii=False))
    except Exception as error:
        # Do not return local paths, PDF internals, or a Python traceback to a client.
        message = str(error) if isinstance(error, ValueError) else "文件解析失败。请确认文件完整，并转换为可提取文字的 PDF 后重试。"
        print(json.dumps({"error": message}, ensure_ascii=False))
        sys.exit(1)
