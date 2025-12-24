package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.List;

import com.pace2020.epace.sdk.util.SecuredWSDLClient;
import com.pace2020.epace.services.rpc.FailedProcessItem;
import com.pace2020.epace.services.rpc.ProcessResults;
import com.pace2020.epace.services.rpc.SuccessProcessItem;

public class EFTBankTransferProcess extends SecuredWSDLClient
{
    public static void main( final String[] args ) throws Exception
    {
        new EFTBankTransferProcess().run();
    }

    public boolean run() throws RemoteException
    {
        try
        {
            final ProcessResults results = getInvokeProcessHttpPort().eFTBankTransferProcess( " 10001 ", " 2 " );

            System.out.println( " EFT Bank Transfer Process " + ( results.isSuccessful() ? "success" : "failure" ) );

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
        catch( Exception e )
        {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }
        return true;

    }
}
