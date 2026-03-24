# **App Name**: SmartSale POS

## Core Features:

- Inventory Management: Manage products by adding new items via barcode scan (EAN-13) or manual entry. Edit product details (name, price, stock) and view a comprehensive product list. Receive alerts for low stock levels.
- Point-of-Sale (POS) Interface: Scan products using the device camera (html5-qrcode) to add them to the sale list. The system automatically calculates and displays the running total. Provides a clear UI for listing purchased items (name, quantity, subtotal) and the accumulated total.
- Integrated POS Calculator: Utilize a built-in calculator within the sales screen for basic arithmetic (+, -, ×, ÷). Add manual product values (e.g., loose produce, soft-serve ice cream) directly to the sale's total and record them as 'manual products'.
- Sale Finalization & Stock Update: Complete transactions with a 'Finalize Purchase' button. This action deducts sold products from inventory, records the sale details in the database, and clears the sales interface for the next transaction.
- Sales History & Basic Reporting: View a detailed history of all sales, including date, time, products sold, manual items, and total amount. Access basic reports like daily and monthly sales summaries, and a list of top-selling products.
- Data Export to Excel: Export current inventory data and the full sales history to .xlsx files with dedicated buttons, providing offline access and further analysis capabilities using the 'xlsx' library.
- Quick Product Registration Tool: When an unregistered barcode is scanned, a tool will provide a guided prompt to quickly enter new product details. This AI-powered tool will suggest relevant fields for rapid creation based on existing product data patterns.

## Style Guidelines:

- Primary color: A confident and professional medium blue (#3366CC) to signify trust and efficiency, ideal for key interactive elements.
- Background color: A subtle and clean very light blue-grey (#F0F3F7) providing a neutral and expansive canvas for content.
- Accent color: A vibrant and distinct violet-purple (#8B4ADF) to draw attention to important calls-to-action and provide visual interest, contrasting effectively with the primary blue.
- Headline and body font: 'Inter', a grotesque sans-serif for its modern, clear, and highly readable characteristics, perfect for both product listings and numerical displays in a POS system.
- Use clear, universally recognizable line icons for key functions (e.g., cart, scan, settings, save) to ensure intuitive navigation and rapid operation, particularly on touch devices. Maintain a minimalist and clean aesthetic.
- A responsive two-column layout optimized for both desktop and mobile touchscreens. The left column will display the sale list and total, while the right features the scanner and calculator. Buttons will be large and tactile-friendly for quick operation, simulating a physical checkout experience.
- Implement subtle, fast feedback animations for user actions, such as item additions to the cart, sale finalization, or successful barcode scans, enhancing responsiveness without causing delays.