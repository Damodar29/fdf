package com.cpbs.bhajans.plugins;

import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;

import androidx.core.app.NotificationCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.cpbs.bhajans.MainActivity;
import com.cpbs.bhajans.R;

import java.io.File;
import java.util.List;
import android.content.ContentResolver;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.provider.MediaStore;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import android.Manifest;
import android.content.ContentUris;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "NativeDownload")
public class NativeDownloadPlugin extends Plugin {

    private static final String CHANNEL_ID = "download_channel_silent";

    // Shared thread pool for all downloads — avoids creating unbounded OS threads
    // when the user starts multiple downloads concurrently.
    // newCachedThreadPool: reuses idle threads; creates new ones only when needed.
    private static final ExecutorService sDownloadExecutor = Executors.newCachedThreadPool();

    private void createNotificationChannel(NotificationManager manager) {
        // minSdkVersion = 26 = O → NotificationChannel always available, no SDK guard
        // needed.
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Downloads",
                NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("File downloads");
        channel.setSound(null, null);
        channel.enableVibration(false);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    @PluginMethod
    public void downloadToPublicFolder(PluginCall call) {
        String url = call.getString("url");
        String filename = call.getString("filename");
        String subpath = call.getString("subpath"); // e.g., "Prem Bhakti/Audios"
        String directory = call.getString("directory", "DOWNLOADS"); // "DOWNLOADS", "PICTURES", or "MUSIC"

        if (url == null || filename == null || subpath == null) {
            call.reject("Must provide url, filename, and subpath");
            return;
        }

        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle(filename);
            request.setDescription("Downloading " + filename);
            // Spoof user agent to prevent Cloudflare/WAF from blocking
            // AndroidDownloadManager with 403 Forbidden
            request.addRequestHeader("User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36");

            // Hide the system's default download notification so we can show our own custom one with the app icon
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_HIDDEN);

            // Set destination in standard public Downloads or Pictures directory
            String envDir = Environment.DIRECTORY_DOWNLOADS;
            if ("PICTURES".equalsIgnoreCase(directory)) {
                envDir = Environment.DIRECTORY_PICTURES;
            } else if ("MUSIC".equalsIgnoreCase(directory)) {
                envDir = Environment.DIRECTORY_MUSIC;
            }
            request.setDestinationInExternalPublicDir(envDir, subpath + "/" + filename);

            DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);

            if (manager != null) {
                final long downloadId = manager.enqueue(request);

                // Save ID for DownloadCompleteReceiver so it can show the completion notification even if the app is closed
                android.content.SharedPreferences prefs = getContext().getSharedPreferences("cpbs_downloads", Context.MODE_PRIVATE);
                java.util.Set<String> activeIds = prefs.getStringSet("active_ids", new java.util.HashSet<>());
                java.util.Set<String> newActiveIds = new java.util.HashSet<>(activeIds);
                newActiveIds.add(String.valueOf(downloadId));
                prefs.edit().putStringSet("active_ids", newActiveIds).apply();

                // Keep the PluginCall alive across the background thread.
                call.setKeepAlive(true);

                // AtomicBoolean allows the polling loop to be safely cancelled
                final AtomicBoolean isDownloading = new AtomicBoolean(true);

                // Submit to shared thread pool — avoids creating a raw OS thread per download.
                sDownloadExecutor.execute(() -> {
                    boolean success = false;
                    
                    NotificationManager notificationManager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
                    NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                            .setSmallIcon(R.mipmap.ic_launcher)
                            .setLargeIcon(android.graphics.BitmapFactory.decodeResource(getContext().getResources(), R.mipmap.ic_launcher))
                            .setContentTitle(filename)
                            .setContentText("Downloading...")
                            .setOngoing(true)
                            .setOnlyAlertOnce(true)
                            .setProgress(100, 0, true);

                    if (notificationManager != null) {
                        notificationManager.notify((int) downloadId, builder.build());
                    }

                    while (isDownloading.get()) {
                        DownloadManager.Query q = new DownloadManager.Query();
                        q.setFilterById(downloadId);
                        Cursor cursor = manager.query(q);
                        try {
                            if (cursor != null && cursor.moveToFirst()) {
                                int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                                if (statusIndex >= 0) {
                                    int status = cursor.getInt(statusIndex);

                                    int downloadedIndex = cursor
                                            .getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
                                    int totalIndex = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);

                                    if (downloadedIndex >= 0 && totalIndex >= 0) {
                                        long bytesDownloaded = cursor.getLong(downloadedIndex);
                                        long bytesTotal = cursor.getLong(totalIndex);
                                        if (bytesTotal > 0) {
                                            JSObject progress = new JSObject();
                                            progress.put("downloadId", downloadId);
                                            progress.put("bytesDownloaded", bytesDownloaded);
                                            progress.put("bytesTotal", bytesTotal);
                                            notifyListeners("onDownloadProgress", progress);
                                            
                                            if (notificationManager != null) {
                                                builder.setProgress(100, (int) (bytesDownloaded * 100 / bytesTotal), false);
                                                notificationManager.notify((int) downloadId, builder.build());
                                            }
                                        }
                                    }

                                    if (status == DownloadManager.STATUS_SUCCESSFUL) {
                                        isDownloading.set(false);
                                        success = true;
                                    } else if (status == DownloadManager.STATUS_FAILED) {
                                        isDownloading.set(false);
                                    }
                                }
                            } else {
                                isDownloading.set(false);
                            }
                        } finally {
                            if (cursor != null)
                                cursor.close();
                        }

                        if (isDownloading.get()) {
                            try {
                                Thread.sleep(500);
                            } catch (InterruptedException e) {
                                // Thread was interrupted (e.g. plugin destroyed) — exit cleanly.
                                Thread.currentThread().interrupt();
                                isDownloading.set(false);
                            }
                        }
                    }

                    if (success) {
                        JSObject ret = new JSObject();
                        ret.put("downloadId", downloadId);
                        // Return the correct root directory for each storage type
                        String rootDir = "PICTURES".equalsIgnoreCase(directory) ? "Pictures"
                                : "MUSIC".equalsIgnoreCase(directory) ? "Music"
                                        : "Download";
                        ret.put("path", rootDir + "/" + subpath + "/" + filename);
                        call.resolve(ret);
                    } else {
                        call.reject("Download failed");
                    }
                });

            } else {
                call.reject("DownloadManager service not available");
            }
        } catch (Exception e) {
            call.reject("Error queueing download: " + e.getMessage());
        }
    }

    /**
     * Opens a PDF file from the public Downloads folder using the system app
     * chooser.
     * Call from JS: NativeDownload.openPdf({ subpath: 'Prem Bhakti/Books',
     * filename: 'MyBook_17123.pdf' })
     */
    @PluginMethod
    public void openPdf(PluginCall call) {
        String subpath = call.getString("subpath"); // e.g. "Prem Bhakti/Books"
        String filename = call.getString("filename"); // e.g. "Title_12345.pdf"

        if (subpath == null || filename == null) {
            call.reject("Must provide subpath and filename");
            return;
        }

        try {
            // Resolve the file in public Downloads
            File downloadsRoot = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            File pdfFile = new File(downloadsRoot, subpath + "/" + filename);

            if (!pdfFile.exists()) {
                call.reject("File not found: " + pdfFile.getAbsolutePath());
                return;
            }

            // Build a content:// URI via FileProvider so other apps can read the file
            Uri contentUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    pdfFile);

            // Fire ACTION_VIEW chooser
            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
            viewIntent.setDataAndType(contentUri, "application/pdf");
            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            // Grant permissions to all matching activities explicitly
            PackageManager pm = getContext().getPackageManager();
            List<ResolveInfo> resInfoList = pm.queryIntentActivities(viewIntent, PackageManager.MATCH_DEFAULT_ONLY);
            for (ResolveInfo resolveInfo : resInfoList) {
                String packageName = resolveInfo.activityInfo.packageName;
                getContext().grantUriPermission(packageName, contentUri, Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }

            Intent chooser = Intent.createChooser(viewIntent, "Open PDF with…");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            // Guard: if no PDF reader is installed, startActivity throws
            // ActivityNotFoundException
            // which crashes the app. Check first before launching.
            if (viewIntent.resolveActivity(getContext().getPackageManager()) != null) {
                getContext().startActivity(chooser);
                call.resolve();
            } else {
                call.reject("No PDF reader app installed. Please install a PDF viewer from Play Store.");
            }

        } catch (Exception e) {
            call.reject("Error opening PDF: " + e.getMessage());
        }
    }

    /**
     * Opens a specific folder in the system file manager.
     * Call from JS: NativeDownload.openFolder({ subpath: 'Prem Bhakti/Audios' })
     */
    @PluginMethod
    public void openFolder(PluginCall call) {
        String subpath = call.getString("subpath");
        String directory = call.getString("directory", "DOWNLOADS"); // "DOWNLOADS", "PICTURES", or "MUSIC"

        if (subpath == null) {
            call.reject("Must provide subpath");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);

            String rootDir = "Download";
            if ("PICTURES".equalsIgnoreCase(directory)) {
                rootDir = "Pictures";
            } else if ("MUSIC".equalsIgnoreCase(directory)) {
                rootDir = "Music";
            }

            String documentId = "primary:" + rootDir + "/" + subpath;
            Uri contentUri = android.provider.DocumentsContract
                    .buildDocumentUri("com.android.externalstorage.documents", documentId);

            intent.setDataAndType(contentUri, "vnd.android.document/directory");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            try {
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception ex) {
                // Fallback to general Downloads folder if specific folder opening fails
                try {
                    Intent fallback = new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS);
                    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(fallback);
                    call.resolve();
                } catch (Exception fallbackEx) {
                    // Ultimate fallback: ACTION_GET_CONTENT
                    Intent ultimateFallback = new Intent(Intent.ACTION_GET_CONTENT);
                    ultimateFallback.setType("*/*");
                    ultimateFallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(ultimateFallback);
                    call.resolve();
                }
            }
        } catch (Exception e) {
            call.reject("Error opening folder: " + e.getMessage());
        }
    }

    /**
     * Opens a URL strictly in the external system browser (not Custom Tabs).
     * This is ideal for file downloads so they process in the background.
     * Call from JS: NativeDownload.openExternalUrl({ url: 'https://...' })
     */
    @PluginMethod
    public void openExternalUrl(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null) {
            call.reject("Must provide url");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse(urlString));
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            try {
                getContext().startActivity(intent);
            } catch (Exception ex) {
                // Fallback to an intent chooser if no default browser is set or intent fails
                Intent chooser = Intent.createChooser(intent, "Open with...");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(chooser);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Error opening external URL: " + e.getMessage());
        }
    }

    /**
     * Deletes a file from the public Downloads folder AND removes its MediaStore entry.
     * This prevents DownloadManager from appending (1) to subsequent downloads.
     */
    @PluginMethod
    public void deleteFile(PluginCall call) {
        String subpath = call.getString("subpath");
        String filename = call.getString("filename");
        String directory = call.getString("directory", "DOWNLOADS");

        if (subpath == null || filename == null) {
            call.reject("Must provide subpath and filename");
            return;
        }

        try {
            String envDir = Environment.DIRECTORY_DOWNLOADS;
            if ("PICTURES".equalsIgnoreCase(directory)) {
                envDir = Environment.DIRECTORY_PICTURES;
            } else if ("MUSIC".equalsIgnoreCase(directory)) {
                envDir = Environment.DIRECTORY_MUSIC;
            }
            File rootDir = Environment.getExternalStoragePublicDirectory(envDir);
            File file = new File(rootDir, subpath + "/" + filename);

            if (file.exists()) {
                file.delete();
            }

            // Also delete from MediaStore to clear zombie records
            ContentResolver resolver = getContext().getContentResolver();
            Uri uri = MediaStore.Files.getContentUri("external");
            String selection = MediaStore.MediaColumns.DATA + "=?";
            String[] selectionArgs = new String[]{file.getAbsolutePath()};
            resolver.delete(uri, selection, selectionArgs);

            call.resolve();
        } catch (Exception e) {
            call.reject("Error deleting file: " + e.getMessage());
        }
    }

    /** Cancels a DownloadManager download (also deletes its partial file). */
    @PluginMethod
    public void cancelDownload(PluginCall call) {
        Long downloadId = call.getLong("downloadId");
        DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        if (downloadId == null || manager == null) {
            call.reject("Must provide downloadId");
            return;
        }
        manager.remove(downloadId);
        cancelNotification(downloadId);
        call.resolve();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Book storage v3: app-specific external dir (Android/data/<pkg>/files/Books)
    //
    // Books used to go to public Download/Prem Bhakti/Books, which piled up copies:
    //  • DownloadManager renames on conflict ("Title (1).pdf", "Title-1.pdf"), and a
    //    JS timeout/cancel never stopped the native download, so every retry added
    //    another file.
    //  • On Android 11+ files from a previous install are no longer owned by the app,
    //    so it can neither see nor delete them, and each reinstall added copies.
    // The app-specific dir needs no permission on any API level, everything in it is
    // always ours to delete, and it is removed on uninstall. Downloads are written to
    // "<name>.part" and renamed only after verifying a complete PDF, so a half-written
    // file is never treated as a book. Names are "<title> [<bookId>].pdf" so the id
    // survives title edits.
    // ─────────────────────────────────────────────────────────────────────────

    private static final String BOOK_PREFS = "cpbs_book_downloads"; // bookId -> active downloadId
    private static final String LEGACY_BOOK_SUBPATH = "Prem Bhakti/Books";
    private static final Pattern BOOK_FILE = Pattern.compile("^.*\\[([^\\[\\]/]+)\\]\\.pdf$");
    private static final String PART = ".part";

    private File getBooksDir() {
        File base = getContext().getExternalFilesDir(null);
        if (base == null) return null;
        File dir = new File(base, "Books");
        if (!dir.exists() && !dir.mkdirs()) return null;
        return dir;
    }

    private static String bookIdOf(String fileName) {
        Matcher m = BOOK_FILE.matcher(fileName);
        return m.matches() ? m.group(1) : null;
    }

    private static boolean belongsToBook(String fileName, String bookId) {
        String tag = "[" + bookId + "].pdf";
        return fileName.endsWith(tag) || fileName.endsWith(tag + PART);
    }

    private static void readFully(FileChannel ch, ByteBuffer buf, long pos) throws java.io.IOException {
        while (buf.hasRemaining()) {
            if (ch.read(buf, pos + buf.position()) < 0) throw new java.io.EOFException();
        }
    }

    /** Complete PDF = starts with "%PDF" and has "%%EOF" in its last 8 KB. Partial downloads and HTML error pages fail. */
    private static boolean isCompletePdf(FileChannel ch) {
        try {
            long size = ch.size();
            if (size < 1024) return false;
            ByteBuffer head = ByteBuffer.allocate(4);
            readFully(ch, head, 0);
            if (!"%PDF".equals(new String(head.array(), StandardCharsets.ISO_8859_1))) return false;
            int tailLen = (int) Math.min(8192, size);
            ByteBuffer tail = ByteBuffer.allocate(tailLen);
            readFully(ch, tail, size - tailLen);
            return new String(tail.array(), StandardCharsets.ISO_8859_1).contains("%%EOF");
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean isCompletePdf(File f) {
        if (f == null || !f.isFile()) return false;
        try (FileInputStream in = new FileInputStream(f)) {
            return isCompletePdf(in.getChannel());
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isCompletePdf(Uri uri) {
        try {
            ParcelFileDescriptor pfd = getContext().getContentResolver().openFileDescriptor(uri, "r");
            if (pfd == null) return false;
            try (FileInputStream in = new ParcelFileDescriptor.AutoCloseInputStream(pfd)) {
                return isCompletePdf(in.getChannel());
            }
        } catch (Exception e) {
            return false;
        }
    }

    private static void copyStream(InputStream in, File out) throws java.io.IOException {
        try (InputStream src = in; OutputStream dst = new FileOutputStream(out)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = src.read(buf)) > 0) dst.write(buf, 0, n);
        }
    }

    private int queryStatus(DownloadManager manager, long downloadId) {
        DownloadManager.Query q = new DownloadManager.Query();
        q.setFilterById(downloadId);
        try (Cursor c = manager.query(q)) {
            if (c != null && c.moveToFirst()) {
                int i = c.getColumnIndex(DownloadManager.COLUMN_STATUS);
                if (i >= 0) return c.getInt(i);
            }
        } catch (Exception ignored) {
        }
        return -1;
    }

    private static boolean isActiveStatus(int status) {
        return status == DownloadManager.STATUS_PENDING
                || status == DownloadManager.STATUS_RUNNING
                || status == DownloadManager.STATUS_PAUSED;
    }

    private File localFileOf(DownloadManager manager, long downloadId, File fallback) {
        DownloadManager.Query q = new DownloadManager.Query();
        q.setFilterById(downloadId);
        try (Cursor c = manager.query(q)) {
            if (c != null && c.moveToFirst()) {
                int i = c.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI);
                String s = i >= 0 ? c.getString(i) : null;
                if (s != null) {
                    Uri u = Uri.parse(s);
                    if ("file".equals(u.getScheme()) && u.getPath() != null) return new File(u.getPath());
                }
            }
        } catch (Exception ignored) {
        }
        return fallback;
    }

    /** Verifies a finished ".part" file, then replaces every older copy of the book with it. */
    private File finalizeBookPart(File dir, File part, String bookId) throws Exception {
        if (part == null || !isCompletePdf(part)) {
            if (part != null) part.delete();
            throw new Exception("CORRUPT");
        }
        String name = part.getName();
        String finalName = name.endsWith(PART) ? name.substring(0, name.length() - PART.length()) : name;
        File[] existing = dir.listFiles();
        if (existing != null) {
            for (File f : existing) {
                if (!f.equals(part) && belongsToBook(f.getName(), bookId)) f.delete();
            }
        }
        File target = new File(dir, finalName);
        if (!target.equals(part) && !part.renameTo(target)) {
            copyStream(new FileInputStream(part), target);
            part.delete();
        }
        return target;
    }

    private void cancelNotification(long downloadId) {
        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel((int) downloadId);
    }

    /** Lets DownloadCompleteReceiver replace our progress notification even if the app is killed mid-download. */
    private void registerForCompletionNotification(long downloadId) {
        SharedPreferences prefs = getContext().getSharedPreferences("cpbs_downloads", Context.MODE_PRIVATE);
        java.util.Set<String> ids = new java.util.HashSet<>(prefs.getStringSet("active_ids", new java.util.HashSet<>()));
        ids.add(String.valueOf(downloadId));
        prefs.edit().putStringSet("active_ids", ids).apply();
    }

    private static JSObject bookResult(File f) {
        JSObject ret = new JSObject();
        ret.put("fileName", f.getName());
        ret.put("size", f.length());
        return ret;
    }

    /**
     * Downloads a book into the app-specific Books dir.
     * JS: NativeDownload.downloadBook({ url, bookId, fileName: "Title [001].pdf", title })
     * Resolves { fileName, size }. Rejects with code CANCELLED | DOWNLOAD_FAILED | CORRUPT | ...
     * Progress: "onBookDownloadProgress" { bookId, downloadId, bytesDownloaded, bytesTotal }.
     */
    @PluginMethod
    public void downloadBook(PluginCall call) {
        String url = call.getString("url");
        String bookId = call.getString("bookId");
        String fileName = call.getString("fileName");
        String title = call.getString("title", fileName);
        if (url == null || bookId == null || fileName == null) {
            call.reject("Must provide url, bookId and fileName", "INVALID_ARGS");
            return;
        }
        if (fileName.contains("/") || !fileName.endsWith("[" + bookId + "].pdf")) {
            call.reject("fileName must end with [" + bookId + "].pdf", "INVALID_ARGS");
            return;
        }
        File dir = getBooksDir();
        DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        if (dir == null || manager == null) {
            call.reject("Storage or DownloadManager unavailable", "STORAGE_UNAVAILABLE");
            return;
        }

        SharedPreferences prefs = getContext().getSharedPreferences(BOOK_PREFS, Context.MODE_PRIVATE);
        long downloadId = prefs.getLong(bookId, -1);
        int status = downloadId != -1 ? queryStatus(manager, downloadId) : -1;

        if (status == DownloadManager.STATUS_SUCCESSFUL) {
            // Finished while the app was closed: finalize it instead of downloading again.
            prefs.edit().remove(bookId).apply();
            try {
                call.resolve(bookResult(finalizeBookPart(dir, localFileOf(manager, downloadId, null), bookId)));
                return;
            } catch (Exception e) {
                status = -1;
            }
        }

        if (!isActiveStatus(status)) {
            if (downloadId != -1) manager.remove(downloadId);
            File part = new File(dir, fileName + PART);
            if (part.exists()) part.delete();
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setTitle(title);
                request.setDescription("Downloading " + title);
                // Spoof user agent to prevent Cloudflare/WAF from blocking AndroidDownloadManager
                request.addRequestHeader("User-Agent",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_HIDDEN);
                request.setDestinationUri(Uri.fromFile(part));
                downloadId = manager.enqueue(request);
            } catch (Exception e) {
                call.reject("Error queueing download: " + e.getMessage(), "ENQUEUE_FAILED");
                return;
            }
            prefs.edit().putLong(bookId, downloadId).apply();
            registerForCompletionNotification(downloadId);
        }
        // else: attach to the in-flight download of this book (double tap, reader
        // auto-fix, or a download still running from before the app was closed)
        // instead of starting a second copy.

        final long id = downloadId;
        call.setKeepAlive(true);
        sDownloadExecutor.execute(() -> pollBookDownload(call, manager, dir, bookId, id, fileName, title));
    }

    private void pollBookDownload(PluginCall call, DownloadManager manager, File dir, String bookId,
            long downloadId, String fileName, String title) {
        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText("Downloading...")
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setProgress(100, 0, true);
        if (nm != null) {
            createNotificationChannel(nm);
            nm.notify((int) downloadId, builder.build());
        }

        String outcome; // SUCCESS | FAILED:<reason> | CANCELLED | INTERRUPTED
        int lastPct = -1;
        while (true) {
            DownloadManager.Query q = new DownloadManager.Query();
            q.setFilterById(downloadId);
            int status = -1;
            int reason = 0;
            long done = 0;
            long total = 0;
            try (Cursor c = manager.query(q)) {
                if (c != null && c.moveToFirst()) {
                    status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                    reason = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
                    done = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                    total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                }
            } catch (Exception ignored) {
            }
            if (status == -1) { // removed via cancelBookDownload / deleteBookFiles
                outcome = "CANCELLED";
                break;
            }
            if (total > 0) {
                JSObject p = new JSObject();
                p.put("bookId", bookId);
                p.put("downloadId", downloadId);
                p.put("bytesDownloaded", done);
                p.put("bytesTotal", total);
                notifyListeners("onBookDownloadProgress", p);
                int pct = (int) (done * 100 / total);
                if (pct != lastPct && nm != null) {
                    lastPct = pct;
                    builder.setProgress(100, pct, false);
                    nm.notify((int) downloadId, builder.build());
                }
            }
            if (status == DownloadManager.STATUS_SUCCESSFUL) {
                outcome = "SUCCESS";
                break;
            }
            if (status == DownloadManager.STATUS_FAILED) {
                outcome = "FAILED:" + reason;
                break;
            }
            try {
                Thread.sleep(500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                outcome = "INTERRUPTED";
                break;
            }
        }

        SharedPreferences prefs = getContext().getSharedPreferences(BOOK_PREFS, Context.MODE_PRIVATE);
        try {
            if ("SUCCESS".equals(outcome)) {
                try {
                    File part = localFileOf(manager, downloadId, new File(dir, fileName + PART));
                    call.resolve(bookResult(finalizeBookPart(dir, part, bookId)));
                } catch (Exception e) {
                    if (nm != null) nm.cancel((int) downloadId);
                    call.reject("Downloaded file is not a complete PDF", "CORRUPT");
                }
            } else if ("INTERRUPTED".equals(outcome)) {
                // Plugin torn down: DownloadManager keeps going and listBookFiles()
                // finalizes the file on the next launch.
                call.reject("Interrupted", "INTERRUPTED");
            } else {
                if (nm != null) nm.cancel((int) downloadId);
                if (outcome.startsWith("FAILED")) {
                    manager.remove(downloadId);
                    call.reject("Download failed (reason " + outcome.substring(7) + ")", "DOWNLOAD_FAILED");
                } else {
                    call.reject("Download cancelled", "CANCELLED");
                }
            }
        } finally {
            if (!"INTERRUPTED".equals(outcome) && prefs.getLong(bookId, -1) == downloadId) {
                prefs.edit().remove(bookId).apply();
            }
            getBridge().releaseCall(call);
        }
    }

    /** Stops the book's native download (if any) and deletes its partial file. */
    @PluginMethod
    public void cancelBookDownload(PluginCall call) {
        String bookId = call.getString("bookId");
        if (bookId == null) {
            call.reject("Must provide bookId", "INVALID_ARGS");
            return;
        }
        stopBookDownload(bookId);
        File dir = getBooksDir();
        File[] files = dir != null ? dir.listFiles() : null;
        if (files != null) {
            for (File f : files) {
                if (f.getName().endsWith("[" + bookId + "].pdf" + PART)) f.delete();
            }
        }
        call.resolve();
    }

    private void stopBookDownload(String bookId) {
        SharedPreferences prefs = getContext().getSharedPreferences(BOOK_PREFS, Context.MODE_PRIVATE);
        long id = prefs.getLong(bookId, -1);
        DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        if (id != -1 && manager != null) {
            manager.remove(id);
            cancelNotification(id);
        }
        prefs.edit().remove(bookId).apply();
    }

    /** Deletes every file (final and partial) of a book and stops its download. */
    @PluginMethod
    public void deleteBookFiles(PluginCall call) {
        String bookId = call.getString("bookId");
        if (bookId == null) {
            call.reject("Must provide bookId", "INVALID_ARGS");
            return;
        }
        stopBookDownload(bookId);
        int deleted = 0;
        File dir = getBooksDir();
        File[] files = dir != null ? dir.listFiles() : null;
        if (files != null) {
            for (File f : files) {
                if (belongsToBook(f.getName(), bookId) && f.delete()) deleted++;
            }
        }
        JSObject ret = new JSObject();
        ret.put("deleted", deleted);
        call.resolve(ret);
    }

    /**
     * Source of truth for downloaded books. Finalizes downloads that finished while
     * the app was closed, deletes orphaned ".part" files, invalid/incomplete PDFs and
     * duplicate copies of the same book, then returns what is left.
     * Resolves { files: [{ bookId, fileName, size }], active: [bookId] }.
     */
    @PluginMethod
    public void listBookFiles(PluginCall call) {
        sDownloadExecutor.execute(() -> {
            try {
                JSArray files = new JSArray();
                JSArray active = new JSArray();
                File dir = getBooksDir();
                if (dir != null) {
                    DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
                    SharedPreferences prefs = getContext().getSharedPreferences(BOOK_PREFS, Context.MODE_PRIVATE);
                    java.util.Set<String> activeIds = new java.util.HashSet<>();
                    for (Map.Entry<String, ?> e : prefs.getAll().entrySet()) {
                        String bookId = e.getKey();
                        long id = e.getValue() instanceof Long ? (Long) e.getValue() : -1;
                        int status = manager != null && id != -1 ? queryStatus(manager, id) : -1;
                        if (isActiveStatus(status)) {
                            activeIds.add(bookId);
                            continue;
                        }
                        if (status == DownloadManager.STATUS_SUCCESSFUL) {
                            try {
                                finalizeBookPart(dir, localFileOf(manager, id, null), bookId);
                            } catch (Exception ignored) {
                            }
                        } else if (manager != null && id != -1) {
                            manager.remove(id);
                        }
                        prefs.edit().remove(bookId).apply();
                    }

                    Map<String, File> best = new HashMap<>();
                    File[] all = dir.listFiles();
                    if (all != null) {
                        for (File f : all) {
                            if (f.isDirectory()) continue;
                            String name = f.getName();
                            if (name.endsWith(PART)) {
                                String owner = bookIdOf(name.substring(0, name.length() - PART.length()));
                                if (owner == null || !activeIds.contains(owner)) f.delete();
                                continue;
                            }
                            String bookId = bookIdOf(name);
                            if (bookId == null || !isCompletePdf(f)) {
                                f.delete();
                                continue;
                            }
                            File prev = best.get(bookId);
                            if (prev == null) {
                                best.put(bookId, f);
                            } else if (f.lastModified() > prev.lastModified()) {
                                prev.delete();
                                best.put(bookId, f);
                            } else {
                                f.delete();
                            }
                        }
                    }
                    for (Map.Entry<String, File> e : best.entrySet()) {
                        JSObject o = bookResult(e.getValue());
                        o.put("bookId", e.getKey());
                        files.put(o);
                    }
                    for (String id : activeIds) active.put(id);
                }
                JSObject ret = new JSObject();
                ret.put("files", files);
                ret.put("active", active);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("listBookFiles failed: " + e.getMessage(), "LIST_FAILED");
            }
        });
    }

    /** Opens a downloaded book in the system PDF app chooser. Rejects with NOT_FOUND or NO_VIEWER. */
    @PluginMethod
    public void openBookFile(PluginCall call) {
        String fileName = call.getString("fileName");
        File dir = getBooksDir();
        if (fileName == null || fileName.contains("/") || dir == null) {
            call.reject("Must provide fileName", "INVALID_ARGS");
            return;
        }
        File f = new File(dir, fileName);
        if (!f.isFile()) {
            call.reject("File not found", "NOT_FOUND");
            return;
        }
        try {
            Uri contentUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
            viewIntent.setDataAndType(contentUri, "application/pdf");
            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            if (viewIntent.resolveActivity(getContext().getPackageManager()) == null) {
                call.reject("No PDF reader app installed", "NO_VIEWER");
                return;
            }
            Intent chooser = Intent.createChooser(viewIntent, "Open PDF with…");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().startActivity(chooser);
            call.resolve();
        } catch (android.content.ActivityNotFoundException e) {
            call.reject("No PDF reader app installed", "NO_VIEWER");
        } catch (Exception e) {
            call.reject("Error opening PDF: " + e.getMessage(), "OPEN_FAILED");
        }
    }

    // ── One-time migration of the old public Download/Prem Bhakti/Books folder ──

    private File legacyBooksDir() {
        return new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), LEGACY_BOOK_SUBPATH);
    }

    private boolean legacyNeedsPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED;
    }

    /** Legacy book files the app can still reach (MediaStore rows it owns on Android 10+, plus File API). */
    private List<JSObject> scanLegacyBooks() {
        List<JSObject> out = new ArrayList<>();
        java.util.Set<String> seen = new java.util.HashSet<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
            String[] proj = {MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME,
                    MediaStore.MediaColumns.SIZE, MediaStore.MediaColumns.DATE_MODIFIED};
            String[] args = {Environment.DIRECTORY_DOWNLOADS + "/" + LEGACY_BOOK_SUBPATH + "/"};
            try (Cursor c = getContext().getContentResolver().query(collection, proj,
                    MediaStore.MediaColumns.RELATIVE_PATH + "=?", args, null)) {
                while (c != null && c.moveToNext()) {
                    String name = c.getString(1);
                    if (name == null) continue;
                    Uri uri = ContentUris.withAppendedId(collection, c.getLong(0));
                    JSObject o = new JSObject();
                    o.put("name", name);
                    o.put("size", c.getLong(2));
                    o.put("mtime", c.getLong(3) * 1000L);
                    o.put("ref", uri.toString());
                    o.put("valid", isCompletePdf(uri));
                    out.add(o);
                    seen.add(name);
                }
            } catch (Exception ignored) {
            }
        }
        File[] files = legacyBooksDir().listFiles();
        if (files != null) {
            for (File f : files) {
                if (!f.isFile() || seen.contains(f.getName())) continue;
                JSObject o = new JSObject();
                o.put("name", f.getName());
                o.put("size", f.length());
                o.put("mtime", f.lastModified());
                o.put("ref", f.getAbsolutePath());
                o.put("valid", isCompletePdf(f));
                out.add(o);
            }
        }
        return out;
    }

    /** Resolves { files: [{ name, size, mtime, ref, valid }], needsPermission }. */
    @PluginMethod
    public void listLegacyBookFiles(PluginCall call) {
        sDownloadExecutor.execute(() -> {
            JSArray files = new JSArray();
            for (JSObject o : scanLegacyBooks()) files.put(o);
            JSObject ret = new JSObject();
            ret.put("files", files);
            ret.put("needsPermission", legacyNeedsPermission());
            call.resolve(ret);
        });
    }

    /** Copies one verified legacy file into the new Books dir as fileName. Resolves { fileName, size }. */
    @PluginMethod
    public void importLegacyBook(PluginCall call) {
        String ref = call.getString("ref");
        String bookId = call.getString("bookId");
        String fileName = call.getString("fileName");
        File dir = getBooksDir();
        if (ref == null || bookId == null || fileName == null || dir == null
                || fileName.contains("/") || !fileName.endsWith("[" + bookId + "].pdf")) {
            call.reject("Invalid arguments", "INVALID_ARGS");
            return;
        }
        sDownloadExecutor.execute(() -> {
            File part = new File(dir, fileName + PART);
            try {
                InputStream in;
                if (ref.startsWith("content://")) {
                    in = getContext().getContentResolver().openInputStream(Uri.parse(ref));
                } else {
                    File src = new File(ref);
                    if (!src.getCanonicalPath().startsWith(legacyBooksDir().getCanonicalPath() + File.separator)) {
                        throw new SecurityException("ref outside legacy books folder");
                    }
                    in = new FileInputStream(src);
                }
                if (in == null) throw new java.io.FileNotFoundException(ref);
                copyStream(in, part);
                call.resolve(bookResult(finalizeBookPart(dir, part, bookId)));
            } catch (Exception e) {
                part.delete();
                call.reject("Import failed: " + e.getMessage(), "IMPORT_FAILED");
            }
        });
    }

    /**
     * Deletes everything the app can reach in the old public books folder, except refs in
     * `keep` (lets JS free space from duplicates before copying the chosen copies).
     * Resolves { deleted, failed }.
     */
    @PluginMethod
    public void wipeLegacyBookFolder(PluginCall call) {
        java.util.Set<String> keep = new java.util.HashSet<>();
        JSArray keepArr = call.getArray("keep");
        if (keepArr != null) {
            for (int i = 0; i < keepArr.length(); i++) {
                String r = keepArr.optString(i, null);
                if (r != null) keep.add(r);
            }
        }
        sDownloadExecutor.execute(() -> {
            int deleted = 0;
            int failed = 0;
            ContentResolver resolver = getContext().getContentResolver();
            for (JSObject o : scanLegacyBooks()) {
                String ref = o.getString("ref");
                if (ref == null || keep.contains(ref)) continue;
                try {
                    boolean ok;
                    if (ref.startsWith("content://")) {
                        ok = resolver.delete(Uri.parse(ref), null, null) > 0;
                    } else {
                        File f = new File(ref);
                        ok = f.delete();
                        if (ok) {
                            resolver.delete(MediaStore.Files.getContentUri("external"),
                                    MediaStore.MediaColumns.DATA + "=?", new String[]{f.getAbsolutePath()});
                        }
                    }
                    if (ok) deleted++;
                    else failed++;
                } catch (Exception e) {
                    failed++;
                }
            }
            File dir = legacyBooksDir();
            String[] left = dir.list();
            if (left != null && left.length == 0) {
                dir.delete();
                File parent = dir.getParentFile();
                String[] parentLeft = parent != null ? parent.list() : null;
                if (parentLeft != null && parentLeft.length == 0) parent.delete();
            }
            JSObject ret = new JSObject();
            ret.put("deleted", deleted);
            ret.put("failed", failed);
            call.resolve(ret);
        });
    }
}