package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.List;

import com.pace2020.epace.sdk.util.SecuredWSDLClient;

public class ListPaceConnectTypes extends SecuredWSDLClient
{
    public ListPaceConnectTypes()
    {
        super();
    }

    public static void main( final String[] args ) throws Exception
    {
        final ListPaceConnectTypes lpct = new ListPaceConnectTypes();
        List<String> types = lpct.run();

        for( String type : types )
        {
            System.out.println( "Type: " + type );
        }
    }

    public List<String> run() throws RemoteException
    {
        return getInvokePaceConnectPort().getPaceConnectTypes().getString();
    }
}
