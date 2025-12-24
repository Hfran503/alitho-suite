package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;

import com.pace2020.epace.object.Customer;
import com.pace2020.epace.object.Job;
import com.pace2020.epace.object.JobCost;
import com.pace2020.epace.object.JobPart;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

/**
 * Created by IntelliJ IDEA. User: jduval Date: Feb 2, 2005 Time: 2:57:41 PM
 */
public class CloneJob extends SecuredWSDLClient
{
    private final String m_customerCode;

    public CloneJob( final String customerCode )
    {
        super();

        m_customerCode = customerCode;
    }

    public static void main( final String[] args ) throws Exception
    {
        //Check to make sure we have 1 parameters passed in
        if( args.length != 1 )
        {
            throw new Exception( "Usage: CloneJob <CUSTCODE>" );
        }
        else
        {
            final CloneJob cloneJob = new CloneJob( args[0] );

            cloneJob.run();
        }
    }

    public Job run() throws RemoteException
    {
        //cloneJobCost();

        // Create a instance of Job, set the customer
        Job job = new Job();
        job.setCustomer( m_customerCode );
        job.setDescription( "description from job 1" );

        job = getCreateObjectPortType().createJob( job );

        //See how the default was populated?
        System.out.println( "Created job " + job.getJob() + " for '"
                                + job.getCustomer()
                                + "' on "
                                + job.getDateSetup() );

        //Normal job clone, just pass in the object to clone
        Job newJob = getCloneObjectPortType().cloneJob( job, null, null, null );

        System.out.println( "Old job customer " + job.getCustomer() );
        System.out.println( "Old job # " + job.getJob() );
        System.out.println( "Old job description " + job.getDescription() );

        System.out.println( "New Job Test 1 customer " + newJob.getCustomer() );
        System.out.println( "New Job Test 1 # " + newJob.getJob() );
        System.out.println( "New Job Test 1 description " + newJob.getDescription() );

        //Clone job, but pass in the new primary key to use
        Job newJob2 = getCloneObjectPortType().cloneJob( job, "A1234", null, null );

        System.out.println( "Old job customer " + job.getCustomer() );
        System.out.println( "Old job # " + job.getJob() );
        System.out.println( "Old job description " + job.getDescription() );

        System.out.println( "New Job Test 2 customer " + newJob2.getCustomer() );
        System.out.println( "New Job Test 2 # " + newJob2.getJob() );
        System.out.println( "New Job Test 2 description " + newJob2.getDescription() );

        Customer cust = new Customer();

        cust.setId( "HOUSE" );

        //Clone job, but pass in a new parent to use instead of current parent
        Job newJob3 = getCloneObjectPortType().cloneJob( job, null, cust, null );

        System.out.println( "Old job customer " + job.getCustomer() );
        System.out.println( "Old job # " + job.getJob() );
        System.out.println( "Old job description " + job.getDescription() );

        System.out.println( "New Job Test 3 customer " + newJob3.getCustomer() );
        System.out.println( "New Job Test 3 # " + newJob3.getJob() );
        System.out.println( "New Job Test 3 description " + newJob3.getDescription() );

        Job newJob4 = new Job();
        newJob4.setDescription( " test of description override" );

        //Clone job , but pass in attributes to override on the cloned object
        newJob4 = getCloneObjectPortType().cloneJob( job, null, null, newJob4 );

        System.out.println( "Old job customer " + job.getCustomer() );
        System.out.println( "Old job # " + job.getJob() );
        System.out.println( "Old job description " + job.getDescription() );

        System.out.println( "New Job Test 4 customer " + newJob4.getCustomer() );
        System.out.println( "New Job Test 4 # " + newJob4.getJob() );
        System.out.println( "New Job Test 4 description " + newJob4.getDescription() );

        //Clone job part into a new job

        JobPart oldPart = getJobPart( "01", job );

        oldPart.setDescription( "Description from old job part" );

        getUpdateObjectPortType().updateJobPart( oldPart );

        Job newJob5 = new Job();

        newJob5.setDescription( " test of description override" );

        JobPart newPart = getCloneObjectPortType().cloneJobPartIntoNewJob( oldPart, null, cust, newJob5 );

        newJob5 = getJob( newPart.getJob() );

        System.out.println( "Old job customer " + job.getCustomer() );
        System.out.println( "Old job # " + job.getJob() );
        System.out.println( "Old job description " + job.getDescription() );
        System.out.println( "Old jobpart description " + oldPart.getDescription() );

        System.out.println( "New Job Test 5 customer " + newJob5.getCustomer() );
        System.out.println( "New Job Test 5 # " + newJob5.getJob() );
        System.out.println( "New Job Test 5 description " + newJob5.getDescription() );
        System.out.println( "New Job Test 5 jobpart description " + newPart.getDescription() );

        return job;
    }

    private JobCost cloneJobCost()
    {
        // Create a instance of JobCost, set the primary key of the one to clone
        JobCost jobCostToClone = new JobCost();

        jobCostToClone.setPrimaryKey( 16401 );

        //read the job cost
        jobCostToClone = getReadObjectPortType().readJobCost( jobCostToClone );

        //newPrimaryKey aka I want to force the new primary KEY, this is used for things like clone a JOB and force the new JOB number to be something.
        //newParent aka I have a Job and I want to clone part 2 if it to a DIFFERENT job, not the current parent data object
        //JobCostAttributesToOverride aka instead of me cloning this object and then making changes to it then making a update object call, I just want to
        // , I can pass into a new Job ( or JobCost in your example ) with the 12 attributes I want to change, then when Pace duplicates it will set those
        // fields for you which will result in less API calls in total.

        //now clone it
        JobCost newJobCostJustDuplicated = getCloneObjectPortType().cloneJobCost( jobCostToClone, null, null, null );

        return newJobCostJustDuplicated;
    }
}
