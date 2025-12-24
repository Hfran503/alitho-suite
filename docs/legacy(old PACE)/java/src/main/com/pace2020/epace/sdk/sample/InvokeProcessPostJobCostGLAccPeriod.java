package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;

import com.pace2020.epace.object.GLAccountingPeriod;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;
import com.pace2020.epace.services.rpc.ProcessResults;

public class InvokeProcessPostJobCostGLAccPeriod extends SecuredWSDLClient
{

    public InvokeProcessPostJobCostGLAccPeriod()
    {
        super();
    }

    public static void main( final String[] args ) throws Exception
    {
        final InvokeProcessPostJobCostGLAccPeriod postJobCost = new InvokeProcessPostJobCostGLAccPeriod();
        postJobCost.run();
    }

    public void run() throws RemoteException
    {
        GLAccountingPeriod accountingPeriod = new GLAccountingPeriod();
        accountingPeriod.setId( 5203 );
        accountingPeriod = getReadObjectPortType().readGLAccountingPeriod( accountingPeriod );
        ProcessResults processResults =
            getInvokeProcessHttpPort().processJobTransactionsGLPeriod( "@id=80078", accountingPeriod );
    }
}

