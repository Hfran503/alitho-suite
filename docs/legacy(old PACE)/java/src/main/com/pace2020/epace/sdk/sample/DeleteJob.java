package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;

import com.pace2020.epace.object.Job;
import com.pace2020.epace.sdk.deleteobject.DeleteObjectPortType;
import com.pace2020.epace.sdk.deleteobject.DeleteObject_Service;

public class DeleteJob extends CreateJob
{
    public DeleteJob( final String customerCode, final String quantityOrdered )
    {
        super( customerCode, quantityOrdered );
    }

    public static void main( final String[] args ) throws Exception
    {
        //Check to make sure we have 2 parameters passed in
        if( args.length != 2 )
        {
            throw new Exception( "Usage: DeleteJob <CUSTCODE> <QTYORDERED>" );
        }
        else
        {
            final DeleteJob createJob = new DeleteJob( args[0], args[1] );

            final Job job = createJob.run();

            final DeleteObjectPortType deleteObjectPortType = new DeleteObject_Service().getDeleteObjectHttpPort();

            deleteObjectPortType.deleteObject( "Job", job.getJob() );

            System.out.println( "Job deleted" );
        }
    }

    @Override
    public Job run() throws RemoteException
    {
        final Job job = super.run();

        final DeleteObjectPortType deleteObjectPortType = new DeleteObject_Service().getDeleteObjectHttpPort();

        getDeleteObjectPortType().deleteObject( "Job", job.getJob() );

        System.out.println( "Job deleted" );

        return null;
    }
}
