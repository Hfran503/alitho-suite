@ECHO OFF

:: CHECK PARMS
IF "%1" == "" goto usageMessage
IF "%2" == "" goto usageMessage
IF "%3" == "" goto usageMessage
IF "%4" == "" goto usageMessage

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
disco /username:%1 /password:%2 http://%3/rpc/%4/services/ReadObject?wsdl    1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/%4/services/Version?wsdl    1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/%4/services/UpdateObject?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/%4/services/DeleteObject?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/%4/services/CreateObject?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/%4/services/CloneObject?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/%4/services/FindObjects?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/%4/services/InvokeAction?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/%4/services/InvokeProcess?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/%4/services/InvokePaceConnect?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/%4/services/GeoLocate?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/%4/services/SystemInspector?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/%4/services/FindCompany?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/%4/services/AttachmentService?wsdl  1>>stubsfetch.log
disco /username:%1 /password:%2 http://%3/rpc/%4/services/ReportService?wsdl  1>>stubsfetch.log



:: MAKE SOME CODE
ECHO Generating Stub Code: PaceUtilPublicCompany.vb
Call :SubMakeParms %3
wsdl /username:%1 /password:%2 /parameters:parms.xml  1>>stubsgen.log

ECHO Moving the PaceUtilPublicCompany.vb to the project folder
move /Y PaceUtilPublicCompany.vb ./..

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
echo   ^<out^>PaceUtilPublicCompany.vb^</out^> >> parms.xml
echo     ^<namespace^>efipaceservices.publiccompany^</namespace^> >> parms.xml
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
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/%4/services/UpdateObject?wsdl" filename="UpdateObject.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/%4/services/DeleteObject?wsdl" filename="DeleteObject.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/%4/services/ReadObject?wsdl" filename="ReadObject.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/%4/services/Version?wsdl" filename="Version.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/%4/services/CreateObject?wsdl" filename="CreateObject.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/%4/services/CloneObject?wsdl" filename="CloneObject.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/%4/services/FindObjects?wsdl" filename="FindObjects.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/%4/services/InvokeProcess?wsdl" filename="InvokeProcess.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/%4/services/InvokeAction?wsdl" filename="InvokeAction.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/%4/services/InvokePaceConnect?wsdl" filename="InvokePaceConnect.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/%4/services/GeoLocate?wsdl" filename="GeoLocate.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/%4/services/SystemInspector?wsdl" filename="SystemInspector.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/%4/services/FindCompany?wsdl" filename="FindCompany.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/%4/services/AttachmentService?wsdl" filename="AttachmentService.wsdl" /^> >> efipace_services.discomap
echo     ^<DiscoveryClientResult referenceType="System.Web.Services.Discovery.ContractReference" url="http://%1/rpc/%4/services/ReportService?wsdl" filename="ReportService.wsdl" /^> >> efipace_services.discomap
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
