package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;

import com.pace2020.epace.object.JobShipment;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

public class ReadJobShipment extends SecuredWSDLClient
{
    private final String m_id;

    public ReadJobShipment( final String id )
    {
        super();

        m_id = id;
    }

    public static void main( final String[] args ) throws Exception
    {
        //Check to make sure we have 1 parameters passed in
        if( args.length != 1 )
        {
            throw new Exception( "Usage: ReadJobShipment <id>" );
        }
        else
        {
            final ReadJobShipment readJobShipment = new ReadJobShipment( args[0] );

            readJobShipment.run();
        }
    }

    public JobShipment run() throws RemoteException
    {
        JobShipment js = new JobShipment();
        js.setId( new Integer( m_id ) );

        js = getReadObjectPortType().readJobShipment( js );
        System.out.println();

        return js;
    }
}

