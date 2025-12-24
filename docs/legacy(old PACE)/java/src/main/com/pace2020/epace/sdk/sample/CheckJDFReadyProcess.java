package com.pace2020.epace.sdk.sample;

import javax.xml.datatype.DatatypeConfigurationException;

import com.pace2020.epace.object.Job;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;
import com.pace2020.epace.services.rpc.ProcessResults;

public class CheckJDFReadyProcess extends SecuredWSDLClient
{
    public CheckJDFReadyProcess()
    {
        super();
    }

    public static void main( final String[] args ) throws Exception
    {
        final Sample sample = new Sample( args[0] );
        sample.run();
    }

    public void run() throws DatatypeConfigurationException
    {
        Job job = new Job();
        job.setJob( "4262" );
        job = getReadObjectPortType().readJob( job );

        final ProcessResults processResults = getInvokeProcessHttpPort().checkJDFReadyProcess( job );
        if( processResults.isSuccessful() )
        {
            System.out.println( processResults.getSuccesses().getSuccessProcessItem().get( 0 ).getReason() );
            System.out.println( processResults.getSuccesses().getSuccessProcessItem().get( 0 ).getObject() );
        }
        else
        {
            System.out.println( processResults.getFailures().getFailedProcessItem().get( 0 ).getReason() );
            System.out.println( processResults.getFailures().getFailedProcessItem().get( 0 ).getObject() );
        }
    }
}
