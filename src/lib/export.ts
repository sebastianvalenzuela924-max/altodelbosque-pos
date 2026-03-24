import * as XLSX from 'xlsx';

/**
 * Exports data to an Excel (.xlsx) file
 * @param filename Name of the file (without extension)
 * @param rows Array of objects containing the data
 * @param sheetName Name of the worksheet
 */
export function exportToExcel(filename: string, rows: any[], sheetName: string = "Datos") {
  if (!rows || !rows.length) return;

  // Create worksheet from JSON data
  const worksheet = XLSX.utils.json_to_sheet(rows);
  
  // Create workbook and append worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate and download file
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Legacy support for CSV exports
 */
export function exportToCSV(filename: string, rows: any[]) {
  exportToExcel(filename, rows);
}
