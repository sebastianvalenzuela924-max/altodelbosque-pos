import * as XLSX from 'xlsx';

/**
 * Exports multiple data sets to a single Excel (.xlsx) file with multiple sheets
 * @param filename Name of the file (without extension)
 * @param sheets Array of objects containing the sheet name and the data rows
 */
export function exportSheetsToExcel(filename: string, sheets: { name: string, data: any[] }[]) {
  const workbook = XLSX.utils.book_new();
  let hasData = false;
  
  sheets.forEach(sheet => {
    if (sheet.data && sheet.data.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(sheet.data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
      hasData = true;
    }
  });

  if (hasData) {
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  }
}

/**
 * Exports data to an Excel (.xlsx) file (Legacy support for single sheet)
 * @param filename Name of the file (without extension)
 * @param rows Array of objects containing the data
 * @param sheetName Name of the worksheet
 */
export function exportToExcel(filename: string, rows: any[], sheetName: string = "Datos") {
  if (!rows || !rows.length) return;
  exportSheetsToExcel(filename, [{ name: sheetName, data: rows }]);
}

/**
 * Legacy support for CSV exports
 */
export function exportToCSV(filename: string, rows: any[]) {
  exportToExcel(filename, rows);
}
