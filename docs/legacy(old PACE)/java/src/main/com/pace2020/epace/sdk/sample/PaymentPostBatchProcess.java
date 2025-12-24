package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.GregorianCalendar;
import java.util.List;
import javax.xml.datatype.DatatypeConfigurationException;
import javax.xml.datatype.DatatypeFactory;

import com.pace2020.epace.sdk.util.SecuredWSDLClient;
import com.pace2020.epace.services.rpc.FailedProcessItem;
import com.pace2020.epace.services.rpc.ProcessResults;
import com.pace2020.epace.services.rpc.SuccessProcessItem;

public class PaymentPostBatchProcess extends SecuredWSDLClient
{
    public static void main( final String[] args ) throws Exception
    {
        new PaymentPostBatchProcess().run();
    }

    public boolean run() throws RemoteException
    {
        try
        {
            final GregorianCalendar gc = new GregorianCalendar();

            final ProcessResults results =
                getInvokeProcessHttpPort().paymentPostBatch( "2009-12",
                                                             DatatypeFactory.newInstance()
                                                                 .newXMLGregorianCalendar( gc ),
                                                             "@approved='true'" );

            System.out.println( " Payment Post Batch " + ( results.isSuccessful() ? "success" : "failure" ) );

            if( null != results.getSuccesses() )
            {

                final List<SuccessProcessItem> successes = results.getSuccesses().getSuccessProcessItem();
                for( final SuccessProcessItem success : successes )
                {
                    System.out.println( "Success: " + success.getReason() );
                }
            }

            final List<FailedProcessItem> failures = results.getFailures().getFailedProcessItem();

            if( null != failures )
            {
                final StringBuffer sb = new StringBuffer( 100 );

                for( final FailedProcessItem failure : failures )
                {
                    sb.append( "\n\t" ).append( failure.getReason() );
                }

                if( failures.size() > 0 )
                {
                    System.out.println( "Failures: " + sb );
                    return false;
                }
            }

        }
        catch( DatatypeConfigurationException e )
        {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }
        return true;

    }
}
