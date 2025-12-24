/*
 * Copyright (c) 2005 Your Corporation. All Rights Reserved.
 */
package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.List;

import com.pace2020.epace.sdk.util.FindObjectsClient;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;


public class FindObjects extends SecuredWSDLClient
{
    public static void main( final String[] args ) throws Exception
    {
        final List jobs = new FindObjects().run();
        System.out.println( "Job count - " + jobs.size() );
    }

    public List run() throws RemoteException
    {
        //Date Filter Sample
        final List<String> keys2 =
            getFindObjectsPortType().find( "Job", "@dateSetup = date( 2005, 8, 11 )" ).getString();

        System.out.println( keys2.size() + " Jobs Setup As Of 2005-08-11" );

        return keys2;
    }

    public static void runSamples() throws Exception
    {
        final FindObjectsClient client = new FindObjectsClient();

        System.out.println( "Pace customers not shared with external CRM - " +
                                client.find( "Customer", "empty(@crmId)" ) );

        System.out.println( "Pace JobParts created from DSF Orders sorted by productionStatus - "
                                + client
            .findAndSort( "JobPart", "not(empty(../@dsfOrderID))", "@productionStatus=desc" ) );

        final List<String> openJobKeys =
            client.findAndSort( "Job", "adminStatus/@openJob", "customer/@custName,@description" );
        final int numJobs = openJobKeys.size();
        System.out.println( numJobs + " - Open Jobs sorted by cutomer.custName and job.description - " );
        System.out.println( openJobKeys.toString() );

        final int limit = 10;
        if( numJobs > limit )
        {
            for( int offset = 0; offset < numJobs; offset += limit )
            {
                final List<String> pagedKeys =
                    client.findSortAndLimit( "Job", "adminStatus/@openJob",
                                             "customer/@custName,@description", offset, limit );

                System.out.println( "Page #" + ( offset / limit + 1 ) + " - " + pagedKeys.toString() );
            }
        }
    }
}
