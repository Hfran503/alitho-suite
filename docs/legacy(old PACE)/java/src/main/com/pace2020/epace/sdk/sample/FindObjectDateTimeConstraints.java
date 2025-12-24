/*
* Copyright (c) 2005 Your Corporation. All Rights Reserved.
*/
package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.Arrays;
import java.util.List;

import com.pace2020.epace.sdk.util.SecuredWSDLClient;


public class FindObjectDateTimeConstraints extends SecuredWSDLClient
{
    public static void main( final String[] args ) throws Exception
    {
        new FindObjectDateTimeConstraints().run();
        new FindObjectDateTimeConstraints().runDateWithNull();
    }

    public List run() throws RemoteException
    {
        //Date Filter Sample with @date = ''
        final List<String> keys3 = getFindObjectsPortType().find( "Job", "@dateSetup =''" ).getString();

        System.out.println( keys3.size() + " Jobs with @dateSetup = null" );

        //Time Filter Sample with @time = ''
        final List<String> keys4 = getFindObjectsPortType().find( "Job", "@timeSetUp =''" ).getString();

        System.out.println( keys4.size() + " Jobs with @timeSetUp = null" );

        //Time Filter Sample with @time != ''
        final List<String> keys5 =
            getFindObjectsPortType().find( "Job", "@timeSetUp = time( 13, 20, 29 )" ).getString();

        System.out.println( keys5.size() + " Jobs with @timeSetUp (13,20,29)" );

        return Arrays.asList( keys3 );
    }

    public List runDateWithNull() throws RemoteException
    {
        //Date Filter Sample with @date != ''
        final List<String> keys2 =
            getFindObjectsPortType().find( "Job", "@dateSetup = date( 2005, 8, 11 )" ).getString();

        System.out.println( keys2.size() + " Jobs Setup As Of 2005-08-11" );
        System.out.println( Arrays.asList( keys2 ).toString() );

        return Arrays.asList( keys2 );
    }
}