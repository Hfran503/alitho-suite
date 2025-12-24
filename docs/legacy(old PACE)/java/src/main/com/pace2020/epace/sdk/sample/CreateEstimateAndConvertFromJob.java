/*
 * Copyright (c) 2019, Electronics for Imaging, Inc. EFI-Pace All Rights Reserved.
 */

package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;

import com.pace2020.epace.object.Job;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

/**
 * @author <a href="mailto:jerry.duval@efi.com">jerry duval</a>
 */
public class CreateEstimateAndConvertFromJob extends SecuredWSDLClient
{
    private final String m_job;

    public CreateEstimateAndConvertFromJob( final String job )
    {
        m_job = job;
    }

    public static void main( final String[] args ) throws Exception
    {
        //Check to make sure we have 1 parameters passed in
        if( args.length != 1 )
        {
            throw new Exception( "Usage: GenerateScheduleForJob <JOB>" );
        }
        else
        {
            final CreateEstimateAndConvertFromJob generateSchedule = new CreateEstimateAndConvertFromJob( args[0] );

            generateSchedule.run();
        }
    }

    public Job run() throws RemoteException
    {
        Job job = new Job();

        try
        {
            job.setPrimaryKey( m_job );

            // load the job passed in using ReadObject Service
            job = getReadObjectPortType().readJob( job );

            //call InvokeAction.createEstimateAndConvert( job ) to "Create Estimate and Convert"
            job = getInvokeActionPortType().createEstimateAndConvert( job );

            System.out.println( "Job generate schedule complete for " + job.getJob() );

            return job;
        }
        catch( Exception e )
        {
            System.out.println( "Unable to generate schedule for '"
                                    + job.getJob()
                                    + "' on "
                                    + job.getDateSetup() );
            throw e;
        }
    }
}

