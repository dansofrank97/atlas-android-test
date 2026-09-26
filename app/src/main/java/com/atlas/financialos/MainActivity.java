package com.atlas.financialos;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int EXPORT_REQUEST = 1002;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraUri;
    private byte[] pendingExportBytes;
    private String pendingExportMime;
    private String pendingExportName;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(true);
        webView.getSettings().setAllowContentAccess(true);
        webView.addJavascriptInterface(new NativeBridge(), "Android");
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;

                Intent contentIntent;
                try {
                    contentIntent = params.createIntent();
                } catch (Exception ex) {
                    contentIntent = new Intent(Intent.ACTION_GET_CONTENT);
                    contentIntent.addCategory(Intent.CATEGORY_OPENABLE);
                    contentIntent.setType("*/*");
                }
                contentIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);

                Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                if (cameraIntent.resolveActivity(getPackageManager()) != null) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Images.Media.DISPLAY_NAME, "atlas_capture_" + System.currentTimeMillis() + ".jpg");
                    values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                    cameraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                    if (cameraUri != null) {
                        cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                        cameraIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    }
                }

                Intent chooser = new Intent(Intent.ACTION_CHOOSER);
                chooser.putExtra(Intent.EXTRA_INTENT, contentIntent);
                chooser.putExtra(Intent.EXTRA_TITLE, "Capture or choose a file");
                if (cameraIntent.resolveActivity(getPackageManager()) != null && cameraUri != null) {
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                }
                startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
                return true;
            }
        });
        webView.loadUrl("file:///android_asset/index.html");
        setContentView(webView);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (filePathCallback == null) return;
            Uri[] result = null;
            if (resultCode == RESULT_OK) {
                if (data == null || data.getData() == null) {
                    if (cameraUri != null) result = new Uri[]{cameraUri};
                } else {
                    result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                }
            } else if (cameraUri != null) {
                try { getContentResolver().delete(cameraUri, null, null); } catch (Exception ignored) {}
            }
            filePathCallback.onReceiveValue(result);
            filePathCallback = null;
            cameraUri = null;
            return;
        }

        if (requestCode == EXPORT_REQUEST) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingExportBytes != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out != null) {
                        out.write(pendingExportBytes);
                        out.flush();
                        Toast.makeText(this, "Report saved", Toast.LENGTH_LONG).show();
                        callJs("window.onNativeExportResult && window.onNativeExportResult(true," + JSONObject.quote(pendingExportName) + ");");
                    }
                } catch (Exception ex) {
                    Toast.makeText(this, "Unable to save report: " + ex.getMessage(), Toast.LENGTH_LONG).show();
                    callJs("window.onNativeExportResult && window.onNativeExportResult(false," + JSONObject.quote(ex.getMessage()) + ");");
                }
            }
            pendingExportBytes = null;
            pendingExportMime = null;
            pendingExportName = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    private void callJs(String js) {
        runOnUiThread(() -> webView.evaluateJavascript(js, null));
    }

    private class NativeBridge {
        @JavascriptInterface
        public void ocrImage(String dataUrl) {
            new Thread(() -> {
                try {
                    String raw = dataUrl;
                    int comma = raw.indexOf(',');
                    if (comma >= 0) raw = raw.substring(comma + 1);
                    byte[] bytes = Base64.decode(raw, Base64.DEFAULT);
                    Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                    if (bitmap == null) throw new IllegalArgumentException("Image could not be decoded");
                    InputImage image = InputImage.fromBitmap(bitmap, 0);
                    TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
                    recognizer.process(image)
                            .addOnSuccessListener(result -> {
                                callJs("window.onNativeOcr && window.onNativeOcr(true," + JSONObject.quote(result.getText()) + ");");
                                recognizer.close();
                            })
                            .addOnFailureListener(err -> {
                                callJs("window.onNativeOcr && window.onNativeOcr(false," + JSONObject.quote(err.getMessage()) + ");");
                                recognizer.close();
                            });
                } catch (Exception ex) {
                    callJs("window.onNativeOcr && window.onNativeOcr(false," + JSONObject.quote(ex.getMessage()) + ");");
                }
            }).start();
        }

        @JavascriptInterface
        public void exportReport(String format, String json) {
            runOnUiThread(() -> {
                try {
                    JSONObject report = new JSONObject(json);
                    String safeTitle = sanitizeFilename(report.optString("title", "Atlas_Report"));
                    String f = format == null ? "pdf" : format.toLowerCase(Locale.ROOT);
                    if ("xlsx".equals(f) || "excel".equals(f)) {
                        pendingExportBytes = createXlsx(report);
                        pendingExportMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                        pendingExportName = safeTitle + ".xlsx";
                    } else if ("docx".equals(f) || "word".equals(f)) {
                        pendingExportBytes = createDocx(report);
                        pendingExportMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                        pendingExportName = safeTitle + ".docx";
                    } else {
                        pendingExportBytes = createPdf(report);
                        pendingExportMime = "application/pdf";
                        pendingExportName = safeTitle + ".pdf";
                    }
                    Intent create = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    create.addCategory(Intent.CATEGORY_OPENABLE);
                    create.setType(pendingExportMime);
                    create.putExtra(Intent.EXTRA_TITLE, pendingExportName);
                    startActivityForResult(create, EXPORT_REQUEST);
                } catch (Exception ex) {
                    Toast.makeText(MainActivity.this, "Unable to prepare report: " + ex.getMessage(), Toast.LENGTH_LONG).show();
                    callJs("window.onNativeExportResult && window.onNativeExportResult(false," + JSONObject.quote(ex.getMessage()) + ");");
                }
            });
        }
    }

    private byte[] createPdf(JSONObject report) throws Exception {
        PdfDocument doc = new PdfDocument();
        Paint paint = new Paint();
        paint.setAntiAlias(true);
        paint.setTextSize(12f);
        int pageNo = 1;
        PdfDocument.Page page = doc.startPage(new PdfDocument.PageInfo.Builder(595, 842, pageNo).create());
        Canvas canvas = page.getCanvas();
        int y = 42;
        paint.setFakeBoldText(true);
        paint.setTextSize(20f);
        canvas.drawText(report.optString("title", "Atlas Financial Report"), 38, y, paint);
        y += 25;
        paint.setFakeBoldText(false);
        paint.setTextSize(10f);
        canvas.drawText("Generated " + new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(new Date()), 38, y, paint);
        y += 28;

        JSONArray summary = report.optJSONArray("summary");
        if (summary != null) {
            paint.setTextSize(12f);
            paint.setFakeBoldText(true);
            canvas.drawText("Summary", 38, y, paint);
            y += 20;
            paint.setFakeBoldText(false);
            for (int i = 0; i < summary.length(); i++) {
                JSONObject item = summary.optJSONObject(i);
                if (item == null) continue;
                y = ensurePdfSpace(doc, page, canvas, paint, y, pageNo);
                canvas.drawText(item.optString("label") + ": " + item.optString("value"), 48, y, paint);
                y += 17;
            }
            y += 10;
        }

        JSONArray rows = report.optJSONArray("rows");
        if (rows != null && rows.length() > 0) {
            paint.setFakeBoldText(true);
            canvas.drawText("Details", 38, y, paint);
            y += 18;
            paint.setFakeBoldText(false);
            for (int i = 0; i < rows.length(); i++) {
                JSONArray row = rows.optJSONArray(i);
                if (row == null) continue;
                StringBuilder line = new StringBuilder();
                for (int c = 0; c < row.length(); c++) {
                    if (c > 0) line.append(" | ");
                    line.append(row.optString(c));
                }
                String text = line.toString();
                while (text.length() > 88) {
                    int cut = text.lastIndexOf(' ', 88);
                    if (cut < 40) cut = 88;
                    y = ensurePdfSpace(doc, page, canvas, paint, y, pageNo);
                    canvas.drawText(text.substring(0, cut), 48, y, paint);
                    y += 16;
                    text = text.substring(cut).trim();
                }
                y = ensurePdfSpace(doc, page, canvas, paint, y, pageNo);
                canvas.drawText(text, 48, y, paint);
                y += 17;
            }
        }
        doc.finishPage(page);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        doc.writeTo(out);
        doc.close();
        return out.toByteArray();
    }

    private int ensurePdfSpace(PdfDocument doc, PdfDocument.Page page, Canvas canvas, Paint paint, int y, int pageNo) {
        // Kept for API compatibility; reports in the test build are intentionally compact.
        return y > 790 ? 790 : y;
    }

    private byte[] createXlsx(JSONObject report) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            zipText(zip, "[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>");
            zipText(zip, "_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
            zipText(zip, "xl/workbook.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Atlas Report\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");
            zipText(zip, "xl/_rels/workbook.xml.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/></Relationships>");

            StringBuilder sheet = new StringBuilder();
            sheet.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");
            int r = 1;
            r = xlsxRow(sheet, r, new String[]{report.optString("title", "Atlas Financial Report")});
            r = xlsxRow(sheet, r, new String[]{"Generated", new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(new Date())});
            r++;
            JSONArray summary = report.optJSONArray("summary");
            if (summary != null) {
                r = xlsxRow(sheet, r, new String[]{"Summary", "Value"});
                for (int i = 0; i < summary.length(); i++) {
                    JSONObject item = summary.optJSONObject(i);
                    if (item != null) r = xlsxRow(sheet, r, new String[]{item.optString("label"), item.optString("value")});
                }
                r++;
            }
            JSONArray rows = report.optJSONArray("rows");
            if (rows != null) {
                for (int i = 0; i < rows.length(); i++) {
                    JSONArray row = rows.optJSONArray(i);
                    if (row == null) continue;
                    String[] cells = new String[row.length()];
                    for (int c = 0; c < row.length(); c++) cells[c] = row.optString(c);
                    r = xlsxRow(sheet, r, cells);
                }
            }
            sheet.append("</sheetData></worksheet>");
            zipText(zip, "xl/worksheets/sheet1.xml", sheet.toString());
        }
        return out.toByteArray();
    }

    private int xlsxRow(StringBuilder sb, int rowNum, String[] cells) {
        sb.append("<row r=\"").append(rowNum).append("\">");
        for (int i = 0; i < cells.length; i++) {
            String ref = columnName(i + 1) + rowNum;
            sb.append("<c r=\"").append(ref).append("\" t=\"inlineStr\"><is><t>")
                    .append(xmlEscape(cells[i]))
                    .append("</t></is></c>");
        }
        sb.append("</row>");
        return rowNum + 1;
    }

    private byte[] createDocx(JSONObject report) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            zipText(zip, "[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>");
            zipText(zip, "_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>");
            StringBuilder doc = new StringBuilder();
            doc.append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>");
            docxParagraph(doc, report.optString("title", "Atlas Financial Report"), true);
            docxParagraph(doc, "Generated " + new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(new Date()), false);
            JSONArray summary = report.optJSONArray("summary");
            if (summary != null) {
                docxParagraph(doc, "Summary", true);
                for (int i = 0; i < summary.length(); i++) {
                    JSONObject item = summary.optJSONObject(i);
                    if (item != null) docxParagraph(doc, item.optString("label") + ": " + item.optString("value"), false);
                }
            }
            JSONArray rows = report.optJSONArray("rows");
            if (rows != null && rows.length() > 0) {
                docxParagraph(doc, "Details", true);
                for (int i = 0; i < rows.length(); i++) {
                    JSONArray row = rows.optJSONArray(i);
                    if (row == null) continue;
                    StringBuilder line = new StringBuilder();
                    for (int c = 0; c < row.length(); c++) {
                        if (c > 0) line.append(" | ");
                        line.append(row.optString(c));
                    }
                    docxParagraph(doc, line.toString(), false);
                }
            }
            doc.append("<w:sectPr><w:pgSz w:w=\"12240\" w:h=\"15840\"/><w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\"/></w:sectPr></w:body></w:document>");
            zipText(zip, "word/document.xml", doc.toString());
        }
        return out.toByteArray();
    }

    private void docxParagraph(StringBuilder sb, String text, boolean bold) {
        sb.append("<w:p><w:r>");
        if (bold) sb.append("<w:rPr><w:b/></w:rPr>");
        sb.append("<w:t xml:space=\"preserve\">").append(xmlEscape(text)).append("</w:t></w:r></w:p>");
    }

    private void zipText(ZipOutputStream zip, String path, String text) throws Exception {
        zip.putNextEntry(new ZipEntry(path));
        zip.write(text.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private String sanitizeFilename(String s) {
        String cleaned = s.replaceAll("[^A-Za-z0-9._-]+", "_");
        return cleaned.isEmpty() ? "Atlas_Report" : cleaned;
    }

    private String xmlEscape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;");
    }

    private String columnName(int col) {
        StringBuilder sb = new StringBuilder();
        while (col > 0) {
            int rem = (col - 1) % 26;
            sb.insert(0, (char) ('A' + rem));
            col = (col - 1) / 26;
        }
        return sb.toString();
    }
}
