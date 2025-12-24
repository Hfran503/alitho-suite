package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.List;

import com.pace2020.epace.sdk.util.SecuredWSDLClient;

public class ListKeysForPaceConnectType extends SecuredWSDLClient
{

    private final String m_ConnectType;

    public ListKeysForPaceConnectType( String connectType )
    {
        super();

        m_ConnectType = connectType;
    }

    public static void main( final String[] args ) throws Exception
    {
        //Check to make sure we have 1 parameter passed in
        if( args.length != 1 )
        {
            throw new Exception( "Usage: ListKeysForPaceConnectType <Connect Type>" );
        }

        final ListKeysForPaceConnectType lkfpct = new ListKeysForPaceConnectType( args[0] );
        final List<String> keys = lkfpct.run();

        for( String key : keys )
        {
            System.out.println( "Key: " + key );
        }
    }

    public List<String> run() throws RemoteException
    {
        return getInvokePaceConnectPort().getKeysForPaceConnectType( m_ConnectType ).getString();
    }
}
