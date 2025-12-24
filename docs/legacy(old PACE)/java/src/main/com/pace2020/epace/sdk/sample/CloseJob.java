package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;

import com.pace2020.epace.object.Job;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

/**
 * Created by IntelliJ IDEA. User: jduval Date: Feb 3, 2005 Time: 10:39:57 AM
 */
public class CloseJob extends SecuredWSDLClient
{
    private final String m_job;
    private final String m_customerCode;

    public CloseJob( final String job, final String cust )
    {
        super();

        m_job = job;
        m_customerCode = cust;
    }

    public static void main( final String[] args ) throws Exception
    {
        //Check to make sure we have 2 parameters passed in
        if( args.length != 2 )
        {
            throw new Exception( "Usage: CloseJob <JOB> <CUSTCODE> " );
        }
        else
        {
            final CloseJob closeJob = new CloseJob( args[0], args[1] );

            closeJob.run();
        }
    }

    public Job run() throws RemoteException
    {
        Job job = verifyJobExists();

        // first check if the parameter for job is valid
        if( null != job )
        {
            System.out.println( "Job exists, attempting to update" );

            //update some job fields prior to closing it
            job.setPromiseDate( null );
            job.setDescription( "Updated via the API" );

            //close the job by setting it's status
            job.setAdminStatus( "C" );

            getUpdateObjectPortType().updateJob( job );

            job.setDescription( "Updated via the API test 2" );

            //reopen job for next sample use
            job.setAdminStatus( "O" );

            getUpdateObjectPortType().updateJob( job );

            System.out.println( "Sent Job change request" );

            job = getReadObjectPortType().readJob( job );

            if( !"O".equals( job.getAdminStatus() ) )
            {
                throw new RuntimeException( "Job closing update failed" );
            }
            else
            {
                System.out.println( "Read shows changed Job is closed" );
            }
        }

        return job;
    }

    private Job verifyJobExists() throws RemoteException
    {
        try
        {
            Job job = new Job();
            job.setJob( m_job );
            return getReadObjectPortType().readJob( job );
        }
        catch( Exception e )
        {
            System.out.println( "Job: " + m_job + " does not exist. Creating new job" );

            // Create a instance of Job, set the customer
            Job job = new Job();
            job.setCustomer( m_customerCode );
            job = getCreateObjectPortType().createJob( job );
            return job;
        }
    }
}

