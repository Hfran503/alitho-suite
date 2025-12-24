@ECHO OFF

:: CHECK PARMS
IF "%1" == "" goto usageMessage
IF "%2" == "" goto usageMessage
IF "%3" == "" goto usageMessage

:: SET PATH
set PATH=%PATH%;C:\Program Files (x86)\Microsoft SDKs\Windows\v8.1A\bin\NETFX 4.5.1 Tools;C:\Windows\Microsoft.NET\Framework64\v4.0.30319

RMDIR /Q /S build 2>NUL
MKDIR build 2>NUL
CD build

:: GET THE WSDLS
ECHO Fetching WSDLs from %3...
disco /username:%1 /password:%2 http://%3/rpc/services/ReadObject?wsdl    1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/services/Version?wsdl    1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/services/UpdateObject?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/services/DeleteObject?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/services/CreateObject?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/services/CloneObject?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/services/FindObjects?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/services/InvokeAction?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/services/InvokeProcess?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/services/InvokePaceConnect?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/services/GeoLocate?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/services/SystemInspector?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/services/FindCompany?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/services/AttachmentService?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/services/ReportService?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/services/TransactionService?wsdl  1>>stubsfetch.log

:: GENERATE STUBS
ECHO Generating Stub Code: PaceUtil.cs
MKDIR stubs 2>NUL
cd stubs

SvcUtil.exe /language:C# /namespace:*,efipaceservices /out:ReadObject.cs ..\ReadObject.wsdl 
csc.exe /target:library /out:PaceUtil.dll ReadObject.cs
SvcUtil.exe /r:PaceUtil.dll /language:C# /namespace:*,efipaceservices /mergeconfig /config:output.config /out:Version.cs ..\Version.wsdl 
csc.exe /target:library /out:PaceUtil.dll ReadObject.cs Version.cs
SvcUtil.exe /r:PaceUtil.dll /language:C# /namespace:*,efipaceservices /mergeconfig /config:output.config /out:UpdateObject.cs ..\UpdateObject.wsdl
csc.exe /target:library /out:PaceUtil.dll ReadObject.cs Version.cs UpdateObject.cs
SvcUtil.exe /r:PaceUtil.dll /language:C# /namespace:*,efipaceservices /mergeconfig /config:output.config /out:DeleteObject.cs ..\DeleteObject.wsdl
csc.exe /target:library /out:PaceUtil.dll ReadObject.cs Version.cs UpdateObject.cs DeleteObject.cs
SvcUtil.exe /r:PaceUtil.dll /language:C# /namespace:*,efipaceservices /mergeconfig /config:output.config /out:CreateObject.cs ..\CreateObject.wsdl
csc.exe /target:library /out:PaceUtil.dll ReadObject.cs Version.cs UpdateObject.cs DeleteObject.cs CreateObject.cs
SvcUtil.exe /r:PaceUtil.dll /language:C# /namespace:*,efipaceservices /mergeconfig /config:output.config /out:CloneObject.cs ..\CloneObject.wsdl
csc.exe /target:library /out:PaceUtil.dll ReadObject.cs Version.cs UpdateObject.cs DeleteObject.cs CreateObject.cs CloneObject.cs
SvcUtil.exe /r:PaceUtil.dll /language:C# /namespace:*,efipaceservices /mergeconfig /config:output.config /out:InvokeAction.cs ..\InvokeAction.wsdl
csc.exe /target:library /out:PaceUtil.dll ReadObject.cs Version.cs UpdateObject.cs DeleteObject.cs CreateObject.cs CloneObject.cs InvokeAction.cs
SvcUtil.exe /r:PaceUtil.dll /language:C# /namespace:*,efipaceservices /mergeconfig /config:output.config /out:InvokeProcess.cs ..\InvokeProcess.wsdl
csc.exe /target:library /out:PaceUtil.dll ReadObject.cs Version.cs UpdateObject.cs DeleteObject.cs CreateObject.cs CloneObject.cs InvokeAction.cs InvokeProcess.cs
SvcUtil.exe /r:PaceUtil.dll /language:C# /namespace:*,efipaceservices /mergeconfig /config:output.config /out:FindCompany.cs ..\FindCompany.wsdl
csc.exe /target:library /out:PaceUtil.dll ReadObject.cs Version.cs UpdateObject.cs DeleteObject.cs CreateObject.cs CloneObject.cs InvokeAction.cs InvokeProcess.cs FindCompany.cs
SvcUtil.exe /r:PaceUtil.dll /language:C# /namespace:*,efipaceservices /mergeconfig /config:output.config /out:AttachmentService.cs ..\AttachmentService.wsdl
csc.exe /target:library /out:PaceUtil.dll ReadObject.cs Version.cs UpdateObject.cs DeleteObject.cs CreateObject.cs CloneObject.cs InvokeAction.cs InvokeProcess.cs FindCompany.cs AttachmentService.cs
SvcUtil.exe /r:PaceUtil.dll /language:C# /namespace:*,efipaceservices /mergeconfig /config:output.config /out:ReportService.cs ..\ReportService.wsdl
csc.exe /target:library /out:PaceUtil.dll ReadObject.cs Version.cs UpdateObject.cs DeleteObject.cs CreateObject.cs CloneObject.cs InvokeAction.cs InvokeProcess.cs FindCompany.cs AttachmentService.cs ReportService.cs
SvcUtil.exe /r:PaceUtil.dll /language:C# /namespace:*,efipaceservices /mergeconfig /config:output.config /out:FindObjects.cs ..\FindObjects.wsdl ..\InvokePaceConnect.wsdl ..\SystemInspector.wsdl ..\GeoLocate.wsdl ..\TransactionService.wsdl
csc.exe /target:library /out:PaceUtil.dll ReadObject.cs Version.cs UpdateObject.cs DeleteObject.cs CreateObject.cs CloneObject.cs InvokeAction.cs InvokeProcess.cs FindCompany.cs AttachmentService.cs ReportService.cs FindObjects.cs

:: COPY STUBS DLL

mv output.config app.config

copy app.config ..\..

copy PaceUtil.dll ..\..

cd ..\..
goto End

:: Usage Message
:usageMessage
ECHO.
ECHO Error Missing Parameters.
ECHO.
ECHO Usage: %0 USERNAME PASSWORD SERVER
ECHO. 
:End