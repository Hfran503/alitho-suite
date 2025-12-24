/*
 * Copyright (c) 2017, Electronics for Imaging, Inc. EFI-Pace All Rights Reserved.
 */

package com.pace2020.epace.sdk.sample;

import java.math.BigDecimal;
import java.rmi.RemoteException;

import com.pace2020.epace.object.ActivityCode;
import com.pace2020.epace.object.ArrayOfJobCost;
import com.pace2020.epace.object.ArrayOfJobPart;
import com.pace2020.epace.object.Employee;
import com.pace2020.epace.object.JobPart;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

/**
 * @author <a href="mailto:jerry.duval@efi.com">jerry duval</a>
 */
public class GangedActivityJobCost extends SecuredWSDLClient
{
    public static void main( final String[] args ) throws Exception
    {
        new GangedActivityJobCost().run();
    }

    public void run() throws RemoteException, InterruptedException
    {
        final String employeeCode = "AA";

        Employee employee = signInEmployee( employeeCode );

        final ArrayOfJobPart jobPartsToGang = new ArrayOfJobPart();

        final String customerCode = "HOUSE";
        final String orderQty = "12345";

        jobPartsToGang.getJobPart().add( createJob( customerCode, orderQty ) );
        jobPartsToGang.getJobPart().add( createJob( customerCode, orderQty ) );
        jobPartsToGang.getJobPart().add( createJob( customerCode, orderQty ) );

        final String activityCode = "20420";

        final ActivityCode activity = getActivityCode( activityCode );

        /**
             *
             * Start a ganged job transaction
             *
             * @param rpcEmployee  Employee
             * @param jobParts  List of Job Parts to create job transactions for
             * @param activityCode ActivityCode
             * @param hours  Hours
             * @param prodUnits  Production Units
             * @param complete Compelte
             * @param beginCount  Begin Count
             * @param endCount End Count
             * @param beginMeter Begin Meter
             * @param endMeter End Meter
             * @param notes Notes
             * @param nonPlannedReason NonPlannedResonID
             * @return JobCost's created
             * @throws XFireFault
             */

        // Elapse time example

        ArrayOfJobCost gangedActivities = getInvokeActionPortType().startGangedJobTransaction( employee,
                                                                                               jobPartsToGang,
                                                                                               activity,
                                                                                               new Double( "0" ),
                                                                                               new Double( "0" ),
                                                                                               false,
                                                                                               new Double( "0" ),
                                                                                               new Double( "0" ),
                                                                                               new BigDecimal( "0" ),
                                                                                               new BigDecimal( "0" ),
                                                                                               null,
                                                                                               null );

        System.out.println( "Started Ganged Job Activity" );

        Thread.sleep( 1000 * 60 * 2 );  // 1000 milli * 60 seconds = 1 min    testing elapsed time

        getInvokeActionPortType().pauseGangedJobTransaction( employee, gangedActivities );

        System.out.println( "Paused Ganged Job Activity" );

        Thread.sleep( 1000 * 60 * 2 );  // 1000 milli * 60 seconds = 1 min    testing elapsed time

        getInvokeActionPortType().resumeGangedJobTransaction( employee, gangedActivities );

        System.out.println( "Resumed Ganged Job Activity" );

        Thread.sleep( 1000 * 60 * 2 );  // 1000 milli * 60 seconds = 1 min    testing elapsed time

        /**
             *
             * Complete a ganged job transaction
             *
             * @param rpcEmployee  Employee
             * @param gangedCosts  Existing list of ganged JobCosts
             * @param prodUnits        Production Units
             * @param complete         Compelte
             * @param beginCount       Begin Count
             * @param endCount         End Count
             * @param beginMeter       Begin Meter
             * @param endMeter         End Meter
             * @param notes            Notes
             * @param nonPlannedReason NonPlannedResonID
             *
             * @return JobCost's created
             */

        gangedActivities =
            getInvokeActionPortType().completeGangedJobTransaction( employee,
                                                                    gangedActivities,
                                                                    new Double( "0" ),
                                                                    true,
                                                                    new Double( "1" ),
                                                                    new Double( "99" ),
                                                                    new BigDecimal( "99" ),
                                                                    new BigDecimal( "50" ),
                                                                    "Ganged Activity Note",
                                                                    null );

        System.out.println( "Completed Ganged Job Activity" );
    }

    private ActivityCode getActivityCode( final String activityCode )
    {
        ActivityCode activity = new ActivityCode();

        activity.setId( activityCode );

        activity = getReadObjectPortType().readActivityCode( activity );
        return activity;
    }

    private Employee signInEmployee( final String employeeCode )
    {
        Employee employee = new Employee();

        employee.setId( employeeCode );

        employee = getReadObjectPortType().readEmployee( employee );

        getInvokeActionPortType().employeeSignIn( employee );

        System.out.println( "Signed in Employee " + employee.getFirstName() + " " + employee.getLastName() );

        return employee;
    }

    private JobPart createJob( final String customerCode, final String orderQty ) throws RemoteException
    {
        final CreateJob createJob = new CreateJob( customerCode, orderQty );

        return getJobPart( "01", createJob.run() );
    }
}