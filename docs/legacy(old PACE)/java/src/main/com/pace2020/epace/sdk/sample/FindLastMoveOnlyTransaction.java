package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.Arrays;
import java.util.Calendar;
import java.util.List;

import com.pace2020.epace.object.Job;
import com.pace2020.epace.object.JobCost;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;


/**
 * @author <a href="mailto:jduval@pace2020.com">jerry duval</a>
 */
public class FindLastMoveOnlyTransaction extends SecuredWSDLClient
{
    private final String m_job;
    private final String m_customerCode;

    public FindLastMoveOnlyTransaction( final String job, final String cust )
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
            throw new Exception( "Usage: FindLastMoveOnlyTransaction <JOB> <CUSTCODE>" );
        }
        else
        {
            final FindLastMoveOnlyTransaction findLastMoveOnlyTransaction =
                new FindLastMoveOnlyTransaction( args[0], args[1] );

            findLastMoveOnlyTransaction.run();
        }
    }

    public Job run() throws RemoteException
    {
        Job job = verifyJobExists();

        // first check if the parameter for job is valid
        if( null != job )
        {
            final String xpath = "activityCode/@chargeBasis = 6 and @job='" + job
                .getJob() + "' and @jobPart='01' and @posted= \"false\"";

            System.out.println( "Finding JobTransactions using XPath " + xpath );

            final List<String> keys = getFindObjectsPortType().find( "JobCost", xpath ).getString();
            System.out.println( Arrays.asList( keys ).toString() );
            Calendar lastDate = null;
            JobCost lastMoveTransaction = null;

            for( final String field : keys )
            {
                JobCost jobTrn = new JobCost();
                jobTrn.setId( Integer.valueOf( field ) );
                jobTrn = getReadObjectPortType().readJobCost( jobTrn );

                /*final Calendar endDate = jobTrn.getEndDate();
                final Calendar stopTime = jobTrn.getStopTime();

                endDate.set( Calendar.HOUR, stopTime.get( Calendar.HOUR ) );
                endDate.set( Calendar.MINUTE, stopTime.get( Calendar.MINUTE ) );

                if( null == lastDate || endDate.after( lastDate ) )
                {
                    lastDate = endDate;
                    lastMoveTransaction = jobTrn;
                }*/
            }

            if( null != lastMoveTransaction )
            {
                System.out.println( "Last Move Job Transaction id = " + lastMoveTransaction.getId() );
            }
            else
            {
                System.out.println( "No Move Job Transactions occured." );
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

