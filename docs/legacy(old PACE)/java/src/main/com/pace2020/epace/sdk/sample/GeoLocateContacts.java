/*
 * Copyright (c) 2005 Your Corporation. All Rights Reserved.
 */
package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.List;

import com.pace2020.epace.sdk.util.SecuredWSDLClient;

public class GeoLocateContacts extends SecuredWSDLClient
{
    public static void main( final String[] args ) throws Exception
    {
        String latitude = args.length > 0 ? args[0] : "30";
        String longitude = args.length > 1 ? args[1] : "-81.5";
        int radius = args.length > 2 ? Integer.parseInt( args[2] ) : 50;
        String xpath = args.length > 3 ? args[3] : "@active = 'true'";

        new GeoLocateContacts().run( latitude, longitude, radius, xpath );
    }

    public void run( String latitude, String longitude, Integer radius, String xpathExpression ) throws RemoteException
    {
        final List<String> keys =
            getGeoLocateHttpPort().findContacts( latitude, longitude, radius, xpathExpression ).getString();

        //final Contact[] contacts = getFindObjectsPortType().getContactList( latitude, longitude, radius, xpathExpression );

        System.out.println( "Following contacts in range: " );
        for( String contact : keys )
            System.out.print( contact + " " );
    }
}
