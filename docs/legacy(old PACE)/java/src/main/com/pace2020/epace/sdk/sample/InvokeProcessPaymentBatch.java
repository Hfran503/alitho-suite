package com.pace2020.epace.sdk.sample;


import java.rmi.RemoteException;

import com.pace2020.epace.object.GLAccountingPeriod;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;
import com.pace2020.epace.services.rpc.ProcessResults;

public class InvokeProcessPaymentBatch extends SecuredWSDLClient
{

    public InvokeProcessPaymentBatch()
    {
        super();
    }

    public static void main( final String[] args ) throws Exception
    {
        final InvokeProcessPaymentBatch paymentBatch = new InvokeProcessPaymentBatch();
        paymentBatch.run();
    }

    public void run() throws RemoteException
    {
        GLAccountingPeriod accountingPeriod = new GLAccountingPeriod();
        accountingPeriod.setId( 5038 );
        accountingPeriod = getReadObjectPortType().readGLAccountingPeriod( accountingPeriod );
        ProcessResults processResults =
            getInvokeProcessHttpPort().processPaymentBatchTrn( "@id=5003", accountingPeriod );
        if( processResults.getSuccesses().getSuccessProcessItem().size() > 0 )
        {
            System.out.println( processResults.getSuccesses().getSuccessProcessItem().get( 0 ).getReason() );
            System.out.println( processResults.getSuccesses().getSuccessProcessItem().get( 0 ).getObject() );
        }
    }
}
