@echo off
echo Generating PDFs...
cd /d "%~dp0"
"C:\Users\plhac\AppData\Local\Python\pythoncore-3.14-64\python.exe" export_pdf.py
if %errorlevel% == 0 (
    echo.
    echo PDFs exported successfully!
) else (
    echo.
    echo Something went wrong. Exit code: %errorlevel%
)
pause
