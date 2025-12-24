/**
 *
 */
package com.pace2020.epace.sdk.sample;

import java.util.GregorianCalendar;
import javax.xml.datatype.DatatypeConfigurationException;
import javax.xml.datatype.DatatypeFactory;

import com.pace2020.appbox.services.rpc.SYAuditLog;
import com.pace2020.appbox.services.rpc.SyAuditLogList;
import com.pace2020.epace.sdk.findobjects.ArrayOfString;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

/**
 * @author nikhilwa
 */
public class GetAuditDataSample extends SecuredWSDLClient
{

    public static void main( String[] args ) throws DatatypeConfigurationException
    {
        final GetAuditDataSample auditDataSample = new GetAuditDataSample();
        auditDataSample.run();
    }

    public void run() throws DatatypeConfigurationException
    {
        ArrayOfString arrayOfString = new ArrayOfString();
        arrayOfString.getString().add( "postCompleted" );
        arrayOfString.getString().add( "reversal" );
        arrayOfString.getString().add( "memoCommitted" );
        arrayOfString.getString().add( "memoApproved" );

        final GregorianCalendar gc = new GregorianCalendar();
        gc.set( 2015, 00, 01 );
        final GregorianCalendar gc1 = new GregorianCalendar();
        gc1.set( 2015, 11, 31 );
        final SyAuditLogList auditLogList = getFindObjectsPortType().getAuditData( "Invoice", null, arrayOfString,
                                                                                   DatatypeFactory.newInstance()
                                                                                       .newXMLGregorianCalendar( gc ),
                                                                                   DatatypeFactory.newInstance()
                                                                                       .newXMLGregorianCalendar( gc1 ),
                                                                                   "PaceSupport", 0, 200 );
        for( SYAuditLog auditLog : auditLogList.getAudits().getSYAuditLog() )
        {
            System.out.println( " Object Key : " + auditLog.getKey() + " - Attribute : " + auditLog
                .getAttribute() + " - Current value : " + auditLog.getCurrentValue() + " - Prior value : " + auditLog
                .getPriorValue() + " - Modified date : " + auditLog.getDate() );
        }


    }

}
