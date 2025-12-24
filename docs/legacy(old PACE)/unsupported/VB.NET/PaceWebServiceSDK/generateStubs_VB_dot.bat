@ECHO OFF

:: CHECK PARMS
IF "%1" == "" goto usageMessage
IF "%2" == "" goto usageMessage
IF "%3" == "" goto usageMessage

:: SET PATH
set PATH=%PATH%;C:\Program Files (x86)\Microsoft SDKs\Windows\v8.1A\bin\NETFX 4.5.1 Tools;C:\Windows\Microsoft.NET\Framework64\v4.0.30319


MKDIR build 2>NUL
CD build

:: CLEANUP
del ReadObject.wsdl   2>NUL
del Version.wsdl   2>NUL
del UpdateObject.wsdl   2>NUL
del DeleteObject.wsdl   2>NUL
del CreateObject.wsdl   2>NUL
del CloneObject.wsdl   2>NUL
del FindObjects.wsdl   2>NUL
del InvokeAction.wsdl   2>NUL
del InvokeProcess.wsdl   2>NUL
del InvokePaceConnect.wsdl	2>NUL
del GeoLocate.wsdl   2>NUL
del SystemInspector.wsdl   2>NUL
del FindCompany.wsdl   2>NUL
del AttachmentService.wsdl   2>NUL
del ReportService.wsdl   2>NUL
del stubsfetch.log   2>NUL
del stubsgen.log   2>NUL

Call :SubMakeDiscoFile %3

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



:: MAKE SOME CODE
ECHO Generating Stub Code: PaceUtil.vb
Call :SubMakeParms %3
wsdl /username:%1 /password:%2 /parameters:parms.xml  1>>stubsgen.log

ECHO Moving the PaceUtil.vb to the project folder
move /Y PaceUtil.vb ./..

CD ..

ECHO Removing build directory
rmdir build /S /Q

goto End


:: Make WSDL Parms File
:SubMakeParms
del parms.xml 2>NUL
echo ^<wsdlParameters xmlns="http://microsoft.com/webReference/"^> >> parms.xml
echo   ^<language^>VB^</language^> >> parms.xml
echo   ^<protocol^>Soap^</protocol^> >> parms.xml
echo   ^<nologo^>true^</nologo^> >> parms.xml
echo   ^<parsableerrors^>true^</parsableerrors^> >> parms.xml
echo   ^<sharetypes^>true^</sharetypes^> >> parms.xml
echo   ^<out^>PaceUtil.vb^</out^> >> parms.xml
echo     ^<namespace^>efipaceservices^</namespace^> >> parms.xml
echo   ^<documents^> >> parms.xml
echo 	^<document^>efipace_services.discomap^</document^> >> parms.xml
echo   ^</documents^> >> parms.xml
echo   ^<webReferenceOptions^> >> parms.xml
echo      ^<codeGenerationOptions^>properties oldAsync^</codeGenerationOptions^> >> parms.xml
echo   ^</webReferenceOptions^> >> parms.xml
echo ^</wsdlParameters^> >> parms.xml
GOTO :EOF

:: Make DISCO File
:SubMakeDiscoFile
del efipace_services.discomap 2>NUL
ECHO ^<?xml version="1.0" encoding="utf-8"?^>  >> efipace_services.discomap 
echo ^<DiscoveryClientResultsFile xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"^> >> efipace_services.discomap
echo   ^<Results^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/services/UpdateObject?wsdl" filename="UpdateObject.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/services/DeleteObject?wsdl" filename="DeleteObject.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/services/ReadObject?wsdl" filename="ReadObject.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/services/Version?wsdl" filename="Version.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/services/CreateObject?wsdl" filename="CreateObject.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/services/CloneObject?wsdl" filename="CloneObject.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/services/FindObjects?wsdl" filename="FindObjects.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/services/InvokeProcess?wsdl" filename="InvokeProcess.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/services/InvokeAction?wsdl" filename="InvokeAction.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/services/InvokePaceConnect?wsdl" filename="InvokePaceConnect.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/services/GeoLocate?wsdl" filename="GeoLocate.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/services/SystemInspector?wsdl" filename="SystemInspector.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/services/FindCompany?wsdl" filename="FindCompany.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/services/AttachmentService?wsdl" filename="AttachmentService.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/services/ReportService?wsdl" filename="ReportService.wsdl" /^> >> efipace_services.discomap
echo   ^</Results^> >> efipace_services.discomap
echo ^</DiscoveryClientResultsFile^> >> efipace_services.discomap
GOTO :EOF
:: Usage Message
:usageMessage
ECHO.
ECHO Error Missing Parameters.
ECHO.
ECHO Usage: %0 USERNAME PASSWORD SERVER
ECHO. 
:End

