package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;

import com.pace2020.epace.object.GLAccount;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

/**
 * Created by IntelliJ IDEA. User: jduval Date: Feb 18, 2005 Time: 2:36:53 PM
 */
public class ReadGLAccount extends SecuredWSDLClient
{
    private final String m_glAccount;

    public ReadGLAccount( final String glAccount )
    {
        super();

        m_glAccount = glAccount;
    }

    public static void main( final String[] args ) throws Exception
    {
        //Check to make sure we have 1 parameters passed in
        if( args.length != 1 )
        {
            throw new Exception( "Usage: ReadGLAccount <glaccount>" );
        }
        else
        {
            final ReadGLAccount readAccount = new ReadGLAccount( args[0] );

            readAccount.run();
        }
    }

    public GLAccount run() throws RemoteException
    {
        GLAccount acct = new GLAccount();
        acct.setId( new Integer( m_glAccount ) );

        acct = getReadObjectPortType().readGLAccount( acct );
        System.out.println( "The account balance is  " + acct.getCurrentPeriodBalance() );

        return acct;
    }
}

