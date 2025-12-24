package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;

import com.pace2020.epace.object.Job;
import com.pace2020.epace.object.JobCost;
import com.pace2020.epace.object.JobPart;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

/**
 * @author <a href="mailto:jduval@pace2020.com">jerry duval</a>
 */
public class CreateJobTransactionUsingOverrideStatusAttribute extends SecuredWSDLClient
{
    private final String m_job;
    private final String m_customerCode;

    public CreateJobTransactionUsingOverrideStatusAttribute( final String job, final String cust )
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
            throw new Exception( "Usage: CreateJobTransactionUsingOverrideStatusAttribute <JOB> <CUSTCODE> " );
        }
        else
        {
            final CreateJobTransactionUsingOverrideStatusAttribute clazz =
                new CreateJobTransactionUsingOverrideStatusAttribute( args[0], args[1] );

            clazz.run();
        }
    }

    public JobCost run() throws RemoteException
    {
        Job job = verifyJobExists();

        JobCost action = null;

        // first check if the parameter for job is valid
        if( null != job )
        {
            System.out.println( "Job exists, attempting to update" );

            //close the job by setting it's status
            job.setAdminStatus( "C" );
            getUpdateObjectPortType().updateJob( job );

            //test adding a JobTransaction to closed status transaction && when setting overrieJobStatus unpersisted attribute on trn = true
            action =
                createJobTransaction( getJobPart( "01", job ), Boolean.TRUE );

            try
            {
                //test adding a JobTransaction to closed status transaction && when setting overrieJobStatus unpersisted attribute on trn = false
                // We expect this to fail, that is a valid test!
                createJobTransaction(
                    getJobPart( "01", job ),
                    Boolean.FALSE );
            }
            catch( RemoteException e )
            {
                System.out
                    .println( "Setting unpersisted fields work for normal unpersisted non calculated attributes" );
            }

            //reopen job for next sample use
            job.setAdminStatus( "O" );
            getUpdateObjectPortType().updateJob( job );
        }

        return action;
    }

    private JobCost createJobTransaction( final JobPart part,
                                          final Boolean override ) throws RemoteException
    {
        JobCost jobTrans = new JobCost();

        jobTrans.setJobPartKey( part.getPrimaryKey() );
        jobTrans.setActivityCode( "000" );
        jobTrans.setOverrideJobStatus( override );

        return getCreateObjectPortType().createJobCost( jobTrans );
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

