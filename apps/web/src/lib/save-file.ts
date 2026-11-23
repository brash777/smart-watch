/** Hands a downloaded file to the browser, which saves it (or opens it on some phones). */
export function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // The click has started the download; the URL is no longer needed after this task.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  });
}
