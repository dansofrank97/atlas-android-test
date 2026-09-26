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

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(true);
        webView.getSettings().setAllowContentAccess(true);
        webView.addJavascriptInterface(new NativeBridge(), "Android");
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                Intent contentIntent;
                try { contentIntent = params.createIntent(); }
                catch (Exception ex) {
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
                if (cameraIntent.resolveActivity(getPackageManager()) != null && cameraUri != null)
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
                return true;
            }
        });
        webView.loadUrl("file:///android_asset/index.html");
        setContentView(webView);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (filePathCallback == null) return;
            Uri[] result = null;
            if (resultCode == RESULT_OK) {
                if (data == null || data.getData() == null) { if (cameraUri != null) result = new Uri[]{cameraUri}; }
                else result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
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
                        out.write(pendingExportBytes); out.flush();
                        Toast.makeText(this, "Report saved", Toast.LENGTH_LONG).show();
                        callJs("window.onNativeExportResult && window.onNativeExportResult(true," + JSONObject.quote(pendingExportName) + ");");
                    }
                } catch (Exception ex) {
                    Toast.makeText(this, "Unable to save report: " + ex.getMessage(), Toast.LENGTH_LONG).show();
                    callJs("window.onNativeExportResult && window.onNativeExportResult(false," + JSONObject.quote(ex.getMessage()) + ");");
                }
            }
            pendingExportBytes = null; pendingExportMime = null; pendingExportName = null;
        }
    }

    @Override public void onBackPressed() { if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed(); }
    private void callJs(String js) { runOnUiThread(() -> webView.evaluateJavascript(js, null)); }

    private class NativeBridge {
        @JavascriptInterface public void ocrImage(String dataUrl) {
            new Thread(() -> {
                try {
                    String raw = dataUrl; int comma = raw.indexOf(','); if (comma >= 0) raw = raw.substring(comma + 1);
                    byte[] bytes = Base64.decode(raw, Base64.DEFAULT);
                    Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                    if (bitmap == null) throw new IllegalArgumentException("Image could not be decoded");
                    InputImage image = InputImage.fromBitmap(bitmap, 0);
                    TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
                    recognizer.process(image).addOnSuccessListener(result -> { callJs("window.onNativeOcr && window.onNativeOcr(true," + JSONObject.quote(result.getText()) + ");"); recognizer.close(); })
                            .addOnFailureListener(err -> { callJs("window.onNativeOcr && window.onNativeOcr(false," + JSONObject.quote(err.getMessage()) + ");"); recognizer.close(); });
                } catch (Exception ex) { callJs("window.onNativeOcr && window.onNativeOcr(false," + JSONObject.quote(ex.getMessage()) + ");"); }
            }).start();
        }

        @JavascriptInterface public void exportReport(String format, String json) {
            runOnUiThread(() -> {
                try {
                    JSONObject report = new JSONObject(json);
                    String safeTitle = sanitizeFilename(report.optString("title", "Atlas_Report"));
                    String f = format == null ? "pdf" : format.toLowerCase(Locale.ROOT);
                    if ("xlsx".equals(f) || "excel".equals(f)) {
                        pendingExportBytes = createXlsx(report); pendingExportMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; pendingExportName = safeTitle + ".xlsx";
                    } else if ("docx".equals(f) || "word".equals(f)) {
                        pendingExportBytes = createDocx(report); pendingExportMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; pendingExportName = safeTitle + ".docx";
                    } else {
                        pendingExportBytes = createPdf(report); pendingExportMime = "application/pdf"; pendingExportName = safeTitle + ".pdf";
                    }
                    Intent create = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    create.addCategory(Intent.CATEGORY_OPENABLE); create.setType(pendingExportMime); create.putExtra(Intent.EXTRA_TITLE, pendingExportName);
                    startActivityForResult(create, EXPORT_REQUEST);
                } catch (Exception ex) {
                    Toast.makeText(MainActivity.this, "Unable to prepare report: " + ex.getMessage(), Toast.LENGTH_LONG).show();
                    callJs("window.onNativeExportResult && window.onNativeExportResult(false," + JSONObject.quote(ex.getMessage()) + ");");
                }
            });
        }
    }

    private class PdfWriter {
        final PdfDocument doc; final JSONObject report; final Paint p = new Paint();
        PdfDocument.Page page; Canvas canvas; int y; int pageNo = 0;
        PdfWriter(PdfDocument d, JSONObject r) { doc=d; report=r; p.setAntiAlias(true); }
        void startPage(boolean continuation) {
            pageNo++; page = doc.startPage(new PdfDocument.PageInfo.Builder(595,842,pageNo).create()); canvas=page.getCanvas(); y=42;
            if (continuation) { p.setTextSize(10); p.setFakeBoldText(true); canvas.drawText(report.optString("company", "Atlas"),38,y,p); p.setFakeBoldText(false); y+=20; canvas.drawLine(38,y,557,y,p); y+=18; }
        }
        void finishPage(){ if(page==null)return; p.setTextSize(8); p.setFakeBoldText(false); canvas.drawText("Atlas Financial OS",38,820,p); String pg="Page "+pageNo; canvas.drawText(pg,557-p.measureText(pg),820,p); doc.finishPage(page); page=null; }
        void ensure(int needed){ if(y+needed>790){finishPage();startPage(true);} }
        void centered(String text,float size,boolean bold){ensure((int)size+14);p.setTextSize(size);p.setFakeBoldText(bold);float x=(595-p.measureText(text))/2f;canvas.drawText(text,Math.max(38,x),y,p);y+=(int)size+9;}
        void heading(String text){ensure(26);p.setTextSize(11);p.setFakeBoldText(true);canvas.drawText(text,38,y,p);y+=17;p.setFakeBoldText(false);}
        void pair(String label,String value,boolean bold){ensure(20);p.setTextSize(10);p.setFakeBoldText(bold);canvas.drawText(trim(label,55),48,y,p);canvas.drawText(value,557-p.measureText(value),y,p);y+=17;p.setFakeBoldText(false);}
        void tableRow(JSONArray row,int idx){ensure(23);String first=row.optString(0);boolean header=idx==0;boolean section=isSection(first,row);boolean total=isTotal(first);p.setTextSize(9);p.setFakeBoldText(header||section||total);if(section){canvas.drawLine(38,y-11,557,y-11,p);}int cols=Math.max(1,row.length());if(cols<=2){canvas.drawText(trim(first,58),section?38:48,y,p);String v=row.length()>1?row.optString(1):"";canvas.drawText(trim(v,24),557-p.measureText(trim(v,24)),y,p);}else{float[] xs=columnPositions(cols);for(int c=0;c<cols;c++){String v=trim(row.optString(c),c==0?20:18);if(c==0)canvas.drawText(v,xs[c],y,p);else if(c==cols-1)canvas.drawText(v,557-p.measureText(v),y,p);else canvas.drawText(v,xs[c],y,p);}}if(header||total)canvas.drawLine(38,y+5,557,y+5,p);y+=19;p.setFakeBoldText(false);}
        float[] columnPositions(int cols){float[] x=new float[cols];float span=500f/(float)Math.max(1,cols);for(int i=0;i<cols;i++)x[i]=38+i*span;return x;}
    }

    private byte[] createPdf(JSONObject report) throws Exception {
        PdfDocument doc=new PdfDocument(); PdfWriter w=new PdfWriter(doc,report); w.startPage(false);
        String company=report.optString("company", "Atlas Demo Enterprise"); String title=report.optString("title", "Financial Report");
        w.centered(company,16,true); w.centered(title.replace(company+" — ",""),13,true);
        String meta="Reporting date: "+report.optString("reportingDate",new SimpleDateFormat("dd MMM yyyy",Locale.US).format(new Date()))+"     Currency: "+report.optString("currency","GHS"); w.centered(meta,9,false); w.y+=8;
        JSONArray summary=report.optJSONArray("summary"); if(summary!=null&&summary.length()>0){w.heading("Summary");for(int i=0;i<summary.length();i++){JSONObject it=summary.optJSONObject(i);if(it!=null)w.pair(it.optString("label"),it.optString("value"),false);}w.y+=8;}
        JSONArray rows=report.optJSONArray("rows"); if(rows!=null&&rows.length()>0){w.heading("Statement details");for(int i=0;i<rows.length();i++){JSONArray row=rows.optJSONArray(i);if(row!=null)w.tableRow(row,i);}}
        w.finishPage(); ByteArrayOutputStream out=new ByteArrayOutputStream(); doc.writeTo(out); doc.close(); return out.toByteArray();
    }

    private byte[] createXlsx(JSONObject report) throws Exception {
        ByteArrayOutputStream out=new ByteArrayOutputStream();
        try(ZipOutputStream zip=new ZipOutputStream(out)){
            zipText(zip,"[Content_Types].xml","<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/></Types>");
            zipText(zip,"_rels/.rels","<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
            zipText(zip,"xl/workbook.xml","<?xml version=\"1.0\" encoding=\"UTF-8\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Financial Report\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");
            zipText(zip,"xl/_rels/workbook.xml.rels","<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>");
            zipText(zip,"xl/styles.xml",xlsxStyles());
            StringBuilder sh=new StringBuilder(); sh.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><cols><col min=\"1\" max=\"1\" width=\"34\" customWidth=\"1\"/><col min=\"2\" max=\"5\" width=\"20\" customWidth=\"1\"/></cols><sheetData>");
            int r=1; r=xlsxStyledRow(sh,r,new String[]{report.optString("company","Atlas Demo Enterprise")},2); r=xlsxStyledRow(sh,r,new String[]{report.optString("title","Financial Report")},2); r=xlsxStyledRow(sh,r,new String[]{"Reporting date",report.optString("reportingDate",new SimpleDateFormat("dd MMM yyyy",Locale.US).format(new Date())),"Currency",report.optString("currency","GHS")},0); r++;
            JSONArray summary=report.optJSONArray("summary"); if(summary!=null){r=xlsxStyledRow(sh,r,new String[]{"SUMMARY","VALUE"},3);for(int i=0;i<summary.length();i++){JSONObject it=summary.optJSONObject(i);if(it!=null)r=xlsxStyledRow(sh,r,new String[]{it.optString("label"),it.optString("value")},0);}r++;}
            JSONArray rows=report.optJSONArray("rows"); if(rows!=null){for(int i=0;i<rows.length();i++){JSONArray row=rows.optJSONArray(i);if(row==null)continue;String[] cells=new String[row.length()];for(int c=0;c<row.length();c++)cells[c]=row.optString(c);int style=i==0?3:(isSection(row.optString(0),row)?3:(isTotal(row.optString(0))?4:0));r=xlsxStyledRow(sh,r,cells,style);}}
            sh.append("</sheetData><pageMargins left=\"0.5\" right=\"0.5\" top=\"0.6\" bottom=\"0.6\" header=\"0.3\" footer=\"0.3\"/></worksheet>"); zipText(zip,"xl/worksheets/sheet1.xml",sh.toString());
        }
        return out.toByteArray();
    }

    private String xlsxStyles(){return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><fonts count=\"3\"><font><sz val=\"10\"/><name val=\"Aptos\"/></font><font><b/><sz val=\"10\"/><name val=\"Aptos\"/></font><font><b/><sz val=\"14\"/><name val=\"Aptos Display\"/></font></fonts><fills count=\"3\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFEAF0FF\"/><bgColor indexed=\"64\"/></patternFill></fill></fills><borders count=\"2\"><border/><border><bottom style=\"thin\"><color rgb=\"FF9AA8C0\"/></bottom></border></borders><cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs><cellXfs count=\"5\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/><xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/><xf numFmtId=\"0\" fontId=\"2\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/><xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"1\" xfId=\"0\"/><xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"1\" xfId=\"0\"/></cellXfs></styleSheet>";}
    private int xlsxStyledRow(StringBuilder sb,int rowNum,String[] cells,int style){sb.append("<row r=\"").append(rowNum).append("\">");for(int i=0;i<cells.length;i++){String ref=columnName(i+1)+rowNum;sb.append("<c r=\"").append(ref).append("\" s=\"").append(style).append("\" t=\"inlineStr\"><is><t xml:space=\"preserve\">").append(xmlEscape(cells[i])).append("</t></is></c>");}sb.append("</row>");return rowNum+1;}

    private byte[] createDocx(JSONObject report) throws Exception {
        ByteArrayOutputStream out=new ByteArrayOutputStream();
        try(ZipOutputStream zip=new ZipOutputStream(out)){
            zipText(zip,"[Content_Types].xml","<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>");
            zipText(zip,"_rels/.rels","<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>");
            StringBuilder d=new StringBuilder();d.append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>");
            docxParagraph(d,report.optString("company","Atlas Demo Enterprise"),true,true,32);docxParagraph(d,report.optString("title","Financial Report"),true,true,26);docxParagraph(d,"Reporting date: "+report.optString("reportingDate",new SimpleDateFormat("dd MMM yyyy",Locale.US).format(new Date()))+"    Currency: "+report.optString("currency","GHS"),false,true,18);
            JSONArray summary=report.optJSONArray("summary");if(summary!=null&&summary.length()>0){docxParagraph(d,"Summary",true,false,22);JSONArray sr=new JSONArray();sr.put(new JSONArray().put("Item").put("Value"));for(int i=0;i<summary.length();i++){JSONObject it=summary.optJSONObject(i);if(it!=null)sr.put(new JSONArray().put(it.optString("label")).put(it.optString("value")));}docxTable(d,sr);}
            JSONArray rows=report.optJSONArray("rows");if(rows!=null&&rows.length()>0){docxParagraph(d,"Statement details",true,false,22);docxTable(d,rows);}
            d.append("<w:sectPr><w:pgSz w:w=\"12240\" w:h=\"15840\"/><w:pgMar w:top=\"1080\" w:right=\"1080\" w:bottom=\"1080\" w:left=\"1080\"/></w:sectPr></w:body></w:document>");zipText(zip,"word/document.xml",d.toString());
        }
        return out.toByteArray();
    }
    private void docxParagraph(StringBuilder sb,String text,boolean bold,boolean center,int halfPoints){sb.append("<w:p>");if(center)sb.append("<w:pPr><w:jc w:val=\"center\"/></w:pPr>");sb.append("<w:r><w:rPr>");if(bold)sb.append("<w:b/>");sb.append("<w:sz w:val=\"").append(halfPoints).append("\"/></w:rPr><w:t xml:space=\"preserve\">").append(xmlEscape(text)).append("</w:t></w:r></w:p>");}
    private void docxTable(StringBuilder sb,JSONArray rows){sb.append("<w:tbl><w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/><w:tblBorders><w:top w:val=\"single\" w:sz=\"4\" w:color=\"B8C2D1\"/><w:left w:val=\"single\" w:sz=\"4\" w:color=\"B8C2D1\"/><w:bottom w:val=\"single\" w:sz=\"4\" w:color=\"B8C2D1\"/><w:right w:val=\"single\" w:sz=\"4\" w:color=\"B8C2D1\"/><w:insideH w:val=\"single\" w:sz=\"3\" w:color=\"D9DFE8\"/><w:insideV w:val=\"single\" w:sz=\"3\" w:color=\"D9DFE8\"/></w:tblBorders></w:tblPr>");for(int r=0;r<rows.length();r++){JSONArray row=rows.optJSONArray(r);if(row==null)continue;boolean emphasis=r==0||isSection(row.optString(0),row)||isTotal(row.optString(0));sb.append("<w:tr>");for(int c=0;c<row.length();c++){sb.append("<w:tc><w:tcPr>");if(emphasis)sb.append("<w:shd w:fill=\"EAF0FF\"/>");sb.append("</w:tcPr><w:p><w:r><w:rPr>");if(emphasis)sb.append("<w:b/>");sb.append("</w:rPr><w:t xml:space=\"preserve\">").append(xmlEscape(row.optString(c))).append("</w:t></w:r></w:p></w:tc>");}sb.append("</w:tr>");}sb.append("</w:tbl>");}

    private boolean isSection(String first,JSONArray row){if(first==null)return false;String s=first.trim();return !s.isEmpty()&&s.equals(s.toUpperCase(Locale.ROOT))&&!isTotal(s)&&(row==null||row.length()<2||row.optString(1).trim().isEmpty()||"GH₵".equals(row.optString(1)));}
    private boolean isTotal(String first){if(first==null)return false;String s=first.trim().toLowerCase(Locale.ROOT);return s.startsWith("total")||s.startsWith("net profit")||s.startsWith("gross profit");}
    private String trim(String s,int max){if(s==null)return"";return s.length()<=max?s:s.substring(0,Math.max(1,max-1))+"…";}
    private void zipText(ZipOutputStream zip,String path,String text)throws Exception{zip.putNextEntry(new ZipEntry(path));zip.write(text.getBytes(StandardCharsets.UTF_8));zip.closeEntry();}
    private String sanitizeFilename(String s){String cleaned=s.replaceAll("[^A-Za-z0-9._-]+","_");return cleaned.isEmpty()?"Atlas_Report":cleaned;}
    private String xmlEscape(String s){if(s==null)return"";return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&apos;");}
    private String columnName(int col){StringBuilder sb=new StringBuilder();while(col>0){int rem=(col-1)%26;sb.insert(0,(char)('A'+rem));col=(col-1)/26;}return sb.toString();}
}
