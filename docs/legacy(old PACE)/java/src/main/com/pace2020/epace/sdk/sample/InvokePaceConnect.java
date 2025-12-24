package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.List;

import com.pace2020.epace.sdk.util.SecuredWSDLClient;
import com.pace2020.epace.services.rpc.FailedProcessItem;
import com.pace2020.epace.services.rpc.ProcessResults;
import com.pace2020.epace.services.rpc.SuccessProcessItem;

public class InvokePaceConnect extends SecuredWSDLClient
{
    private final String m_ConnectId;
    private final String m_ConnectInput;

    public InvokePaceConnect( final String connectId, final String connectInput )
    {
        super();

        m_ConnectId = connectId;
        m_ConnectInput = connectInput;
    }

    public static void main( final String[] args ) throws Exception
    {
        //Check to make sure we have 2 parameters passed in
        if( args.length != 2 )
        {
            throw new Exception( "Usage: InvokePaceConnect <Connect Code> <Connect Input>" );
        }
        else
        {
            final InvokePaceConnect ipc = new InvokePaceConnect( args[0], args[1] );

            ipc.run();
        }
    }

    public boolean run() throws RemoteException
    {
        ProcessResults results = getInvokePaceConnectPort().invokePaceConnect( m_ConnectId, m_ConnectInput );
        final List<SuccessProcessItem> successes = results.getSuccesses().getSuccessProcessItem();

        if( null != successes )
        {
            final StringBuffer sb = new StringBuffer( 100 );

            for( final SuccessProcessItem success : successes )
            {
                sb.append( "\n\t" ).append( success.getReason() );
            }

            System.out.println( "Successes: " + sb );
        }

        final List<FailedProcessItem> failures = results.getFailures().getFailedProcessItem();

        if( null != failures )
        {
            final StringBuffer sb = new StringBuffer( 100 );

            for( final FailedProcessItem failure : failures )
            {
                sb.append( "\n\t" ).append( failure.getReason() );
            }

            System.out.println( "Failures: " + sb );

            if( failures.size() > 0 )
            {
                return false;
            }
        }

        return true;
    }
}
