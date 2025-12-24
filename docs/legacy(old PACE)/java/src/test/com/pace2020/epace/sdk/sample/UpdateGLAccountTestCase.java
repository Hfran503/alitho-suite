package com.pace2020.epace.sdk.sample;

import com.pace2020.epace.object.GLAccount;
import junit.framework.TestCase;

/*
 * Copyright (c) 2005 Pace Systems Group, Inc. All Rights Reserved.
 */

/**
 * @author <a href="mailto:jcaldwell@pace2020.com">jeff caldwell</a>
 */
public class UpdateGLAccountTestCase extends TestCase
{
    public void testUpdateGLAccount() throws Exception
    {
        final ReadGLAccount readAcct = new ReadGLAccount( "2" );
        GLAccount gl = readAcct.run();

        String origName = gl.getName();
        String newName = "TEST SET NAME";

        final UpdateGLAccount updateAcct = new UpdateGLAccount( gl );
        updateAcct.run( newName );

        GLAccount gl2 = readAcct.run();
        assertTrue( gl2.getName().equals( newName ) );

        updateAcct.run( origName );

        GLAccount gl3 = readAcct.run();
        assertTrue( gl3.getName().equals( origName ) );
    }
}