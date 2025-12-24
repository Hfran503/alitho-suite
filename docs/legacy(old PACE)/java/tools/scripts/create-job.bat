rem Script assumes
rem SDK 1.4.6    http://sun.java.com
rem ANT 1.6.1    http://ant.apache.org/
rem Add a enivronment variable for JAVA_HOME with path to the SDK ( example C:\j2sdk1.4.2_06)
rem Add ant bin to your path  ( example C:\ant\bin;) 
cd ../../

set ANT_OPTS=-Xmx256m

call ant create-job;

rem call ant run-create-job       Can be used to run and complie class
pause