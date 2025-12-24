/*
 * Copyright (c) 2005 Your Corporation. All Rights Reserved.
 */
package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.Arrays;
import java.util.List;

import com.pace2020.epace.sdk.util.SecuredWSDLClient;
import com.pace2020.epace.services.rpc.FailedProcessItem;
import com.pace2020.epace.services.rpc.ProcessResults;

public class InvokeProcess extends SecuredWSDLClient
{
    public static void main( final String[] args ) throws Exception
    {
        new InvokeProcess().run();
    }

    public boolean run() throws RemoteException
    {
        //Post InventoryLine Objects
        //final int posted = getInvokeProcessHttpPort().postInventoryTrn( true );

        //Post Job Transactions
        //final ProcessResults results = getInvokeProcessHttpPort().processJobTransactions( "@approved" );

        //Post all approved
        final ProcessResults results = getInvokeProcessHttpPort().postGLBatchTrn( "@approved" );

        System.out.println( "GL Batch Trn Post was a "
                                + ( results.isSuccessful() ? "success" : "failure" ) );

        if( null != results.getSuccesses() )
        {
            System.out.println( "Successes: " + Arrays.asList( results.getSuccesses() ) );
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
