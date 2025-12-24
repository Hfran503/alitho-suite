package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;

import com.pace2020.epace.object.Customer;
import com.pace2020.epace.object.Job;
import com.pace2020.epace.object.JobPart;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

/**
 * Created by IntelliJ IDEA. User: jduval Date: Feb 2, 2005 Time: 2:57:41 PM
 */
public class CreateJob extends SecuredWSDLClient
{
    private final String m_customerCode;
    private final String m_quantityOrdered;

    public CreateJob( final String customerCode, final String quantityOrdered )
    {
        super();

        m_customerCode = customerCode;
        m_quantityOrdered = quantityOrdered;
    }

    public static void main( final String[] args ) throws Exception
    {
        //Check to make sure we have 2 parameters passed in
        if( args.length != 2 )
        {
            throw new Exception( "Usage: CreateJob <CUSTCODE> <QTYORDERED>" );

        }
        else
        {
            final CreateJob createJob = new CreateJob( args[0], args[1] );

            createJob.run();
        }
    }

    public Job run() throws RemoteException
    {
        // first check if the parameter for customer is valid
        if( verifyCustomerExists() )
        {
            // Create a instance of Job, set the customer
            Job job = new Job();

            try
            {
                /* It is not required to get the next Job number because Pace will auto assign, but you can
     Please note if you set the Job's number, the number factory will not increment for the next number
     job.setJob( getNextJobNumber( readObjectPortType ) );
     create the Job and set the job to the local variable */
                job = getCreateObjectPortType().createJob( job );
            }
            catch( Exception e )
            {
                if( e.getMessage().startsWith( "Field is required: Job[customer=null]" ) )
                {
                    job.setCustomer( m_customerCode );
                    job = getCreateObjectPortType().createJob( job );
                }
                else
                {
                    throw new RemoteException( "Unable to find customer", e );
                }
            }

            //See how the default was populated?
            System.out.println( "Created job for '"
                                    + job.getCustomer()
                                    + "' on "
                                    + job.getDateSetup() );

            //update the Job PartQty Ordered
            updateJobPart( job );
            System.out.println( "Job add addition complete for " + job.getJob() );
            return job;
        }
        return null;
    }

    private void updateJobPart( final Job job )
        throws RemoteException
    {
        final Integer qtyOrdered = new Integer( m_quantityOrdered );
        JobPart part = getJobPart( "01", job );

        System.out.println( "Quantity Ordered " + qtyOrdered );
        part.setQtyOrdered( qtyOrdered );
        getUpdateObjectPortType().updateJobPart( part );

        System.out.println( "Sent JobPart.qtyOrdered change request" );

        part = getJobPart( part.getJobPart(), job );

        if( !qtyOrdered.equals( part.getQtyOrdered() ) )
        {
            throw new RuntimeException( "JobPart quantity update failed" );
        }
        else
        {
            System.out.println( "Read shows changed JobPart.qtyOrdered: '" + part.getQtyOrdered() );
        }
    }

    private boolean verifyCustomerExists()
    {
        try
        {
            final Customer cust = new Customer();

            cust.setId( m_customerCode );

            return null != getReadObjectPortType().readCustomer( cust );
        }
        catch( Exception e )
        {
            System.out.println( "Customer: " + m_customerCode + " does not exist. Not adding job" + e.getMessage() );
            return false;
        }
    }
}
